# T478 - CircleCI mac runtime and main merge repair

Status: DONE

## Context

PR #217 is open but GitHub reports it as conflicting after `origin/main` moved
through #219, #221, and #220. CircleCI is otherwise close to green, but the
`mac-arm-build` job still fails in `validate:mac-private-release-boundary` with
`hardened runtime flag missing from Info.plist and signing output`.

## Goal

Reconcile PR #217 with current `origin/main` and repair the mac private-release
runtime enforcement so CircleCI can revalidate the branch.

## Required UI

None.

## Required Data/API

No production data or API changes.

## Required Automations

- Add a regression that requires an explicit mac post-sign hook to enforce
  ad-hoc signing with hardened runtime.
- Keep the mac ARM workflow validator aligned with the new hook.

## Required Subagents

None required.

## TDD Requirements

- Add the failing static mac-boundary test before creating the hook.
- Confirm RED because the post-sign hook is absent.

## Implementation Requirements

- Resolve the `user-data-migration` conflict with current `origin/main`
  behavior unless validation proves the branch behavior is required.
- Do not disable the mac private-release validator.
- Do not weaken the hardened runtime, ad-hoc signature, TeamIdentifier, or
  entitlement checks.
- Do not perform destructive R.11 actions, mutate tags, delete branches, create
  backup refs, run `git filter-repo`, force-push, clear `/goal`, or call
  `update_goal`.

## Validation Commands

- `bun test scripts/__tests__/validate-mac-boundary-fixtures.test.ts`
- `bun run validate:mac-arm-build-workflow`
- `bun run validate:mac-private-release-boundary`
- `bun test packages/shared/src/config/__tests__/user-data-migration.test.ts`
- `git diff --check`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `bun run validate:roadmap`

## Acceptance Criteria

- [x] RED assertion fails because the mac post-sign runtime hook is absent.
- [x] Branch merges current `origin/main` without unresolved conflicts.
- [x] Mac packaging config wires a post-sign runtime enforcement hook.
- [x] Mac boundary tests and validators pass locally.
- [x] User-data migration conflict resolution passes its targeted tests.
- [x] PR #217 was pushed for fresh CI from T478 commit `4b9fd262`.
- [x] No destructive R.11 action is performed.
