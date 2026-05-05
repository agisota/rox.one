# T062 - Upstream v0.9.1 Merge Implementation

Status: DONE

## Goal

Merge upstream `lukilabs/craft-agents-oss` `v0.9.1` into the protected branch
`mac/upstream-v0.9.1-rox-merge` while preserving ROX-owned product layers.

## Context

T061 prepared the protected path map and validation matrix. T062 performs the
actual merge/conflict resolution on the protected branch, not on `main`.

## Scope

- Merge upstream `v0.9.1` into `mac/upstream-v0.9.1-rox-merge`.
- Resolve conflicts path-by-path.
- Preserve ROX-owned Workbench, account, Experience Layer, sync, release docs,
  Russian localization, and backlog/worklog surfaces.
- Update package/lock/build/CI surfaces only as needed for the upstream merge.
- Run the documented validation matrix or record precise blockers.

## Acceptance Criteria

- [x] `v0.9.1` is an ancestor of the branch after merge.
- [x] ROX protected surfaces remain present.
- [x] `bun run validate:agent-contract` passes.
- [x] `bun run validate:docs` passes.
- [x] `bun run typecheck:all` passes or a precise blocker is documented.
- [x] `bun test` passes or a precise blocker is documented.
- [x] `bun run lint:i18n:parity` passes or a precise blocker is documented.
- [x] `bun run e2e:core` passes or a precise blocker is documented.
- [x] `bun run electron:build` passes or a precise blocker is documented.
- [x] `git diff --check` passes.
- [x] Worklog is complete.
