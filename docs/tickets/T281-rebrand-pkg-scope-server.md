# T281 - Rebrand server package scopes

Status: DONE

## Context

Phase R.5.9 renames the high-fan-in server workspace packages after the Pi
agent server package scope has landed. Current lookup shows
`@craft-agent/server` is package metadata and lockfile only, while
`@craft-agent/server-core` is used by package metadata, workspace dependencies,
tsconfig paths, source imports, tests, and the server build alias.

## Goal

Rename `@craft-agent/server` and `@craft-agent/server-core` to
`@rox-one/server` and `@rox-one/server-core` across active package metadata,
workspace dependencies, TypeScript imports, tsconfig paths, build aliases, and
the lockfile.

## Required UI

None.

## Required Data/API

None.

## Required Automations

None.

## Required Subagents

Use an explorer pass for the active R.5.9 reference map because server-core is a
high-fan-in package.

## TDD Requirements

Extend the R.5 package-scope regression test before implementation and confirm
it fails on the current `@craft-agent/server` and `@craft-agent/server-core`
names.

## Implementation Requirements

- Rename `packages/server/package.json` `name` to `@rox-one/server`.
- Rename `packages/server-core/package.json` `name` to
  `@rox-one/server-core`.
- Rename active `@craft-agent/server-core` workspace dependencies to
  `@rox-one/server-core`.
- Rename active `@craft-agent/server-core` imports and dynamic imports to
  `@rox-one/server-core`.
- Rename active tsconfig path mappings and the `scripts/build-server.ts`
  server-core alias to the ROX scope.
- Refresh `bun.lock` with `bun install`.
- Do not rename `@craft-agent/shared` or app package scopes in this ticket.
- Do not create the shared package R.5.10 compatibility shim in this ticket.

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

- [x] Ticket exists before code changes.
- [x] Red test proves the server package-scope gap.
- [x] Server package metadata uses `@rox-one/server`.
- [x] Server-core package metadata uses `@rox-one/server-core`.
- [x] Active server-core dependencies, imports, path mappings, and build alias
      use `@rox-one/server-core`.
- [x] Lockfile is refreshed.
- [x] Full suite passes after commit.
- [x] Build passes.
- [x] Validation evidence is recorded in the worklog.
- [x] Worklog complete.
- [x] Commit created.

## Worklog

Update `docs/worklog/T281-rebrand-pkg-scope-server.md`.
