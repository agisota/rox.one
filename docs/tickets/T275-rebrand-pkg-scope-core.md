# T275 - Rebrand core package scope

Status: DONE

## Context

Phase R.5.3 renames the core workspace package after the UI scope has landed.
Core is a high-fan-in type and utility layer consumed by apps and runtime
packages, so this slice must stay isolated from audit, session, messaging,
server, shared, and app package-scope renames.

## Goal

Rename `@rox-agent/core` to `@rox-one/core` across core package metadata,
workspace dependencies, imports, exports, tsconfig path mappings, active package
docs/comments, and the lockfile.

## Required UI

None.

## Required Data/API

None.

## Required Automations

None.

## Required Subagents

No subagent required; direct `rg` shows a bounded package/import surface for
the core scope.

## TDD Requirements

Extend the R.5 package-scope regression test before implementation and confirm
it fails on the current `@rox-agent/core` package name.

## Implementation Requirements

- Rename `packages/core/package.json` `name` to `@rox-one/core`.
- Update workspace package dependencies to `@rox-one/core`.
- Update active imports, type imports, package docs/comments, and tsconfig
  path mappings from `@rox-agent/core` to `@rox-one/core`.
- Refresh `bun.lock` with `bun install`.
- Do not rename any other package scope in this ticket.

## Validation Commands

- `bun test scripts/__tests__/rebrand-package-scope.test.ts`
- `bun install`
- `bun run typecheck`
- `bun run lint`
- `bun test`
- `bun run build`
- `bun run validate:agent-contract`
- `bun run validate:docs`
- `git diff --check`
- `bun run validate:rebrand` (expected red until later R.5/R.6/R.7 phases)

## Acceptance Criteria

- [x] Red test proves the core package-scope gap.
- [x] Core package metadata uses `@rox-one/core`.
- [x] Workspace dependencies use `@rox-one/core`.
- [x] Active imports and tsconfig path mappings use `@rox-one/core`.
- [x] Lockfile is refreshed.
- [x] Full suite passes after commit.
- [x] Build passes after commit.
- [x] Validation evidence is recorded in the worklog.
- [x] Worklog complete.
- [x] Commit created.

## Worklog

Update `docs/worklog/T275-rebrand-pkg-scope-core.md`.
