# T061 - Upstream v0.9.1 Merge Plan

Status: DONE

## Goal

Prepare a protected upstream merge/rebase plan for `lukilabs/rox-agents-oss`
`v0.9.1` without merging upstream into `main` and without overwriting ROX-owned
product layers.

## Context

The local fork is no longer a clean Rox checkout. It contains ROX ONE
branding/localization, account/session surfaces, Workbench flows, Experience
Layer screens, sync contracts, release docs, and backlog/worklog control files.
Upstream `v0.9.1` must therefore be integrated through a protected branch and a
path-level conflict plan.

## Scope

- Verify upstream remote and `v0.9.1` tag source.
- Create/use branch `mac/upstream-v0.9.1-rox-merge`.
- Generate an upstream diff and protected ROX-owned path map.
- Record expected merge conflict clusters and validation commands.
- Do not perform the final upstream merge in this ticket.
- Do not modify runtime product code in this ticket.

## Protected ROX-Owned Surfaces

- `apps/electron/src/renderer/components/workbench/`
- `apps/electron/src/renderer/pages/settings/`
- `apps/electron/src/main/account-api.ts`
- `packages/shared/src/workbench/`
- `packages/shared/src/i18n/`
- `packages/server-core/src/webui/`
- `packages/server-core/src/sync/`
- `docs/tickets/`
- `docs/worklog/`
- `docs/release/`
- `.swarm/`

## Required Validation for T062

- `bun run validate:agent-contract`
- `bun run validate:docs`
- `bun run typecheck:all`
- `bun test`
- `bun run lint:i18n:parity`
- `bun run e2e:core`
- `bun run electron:build`
- `git diff --check`

## Acceptance Criteria

- [x] Upstream remote and `v0.9.1` tag source are verified.
- [x] Merge branch is prepared outside `main`.
- [x] Protected-file map exists.
- [x] Merge risk matrix exists.
- [x] Required validation matrix exists.
- [x] No final upstream merge is performed in T061.
- [x] Worklog is complete.
