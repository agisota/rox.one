# T282 - Rebrand shared package scope

Status: DONE

## Context

Phase R.5.10 renames the highest fan-in workspace package after the server and
server-core package scopes have landed. `@craft-agent/shared` remains the active
shared package name and is still referenced by app/package dependencies,
TypeScript imports, tsconfig paths, package exports documentation, tests, build
scripts, and `bun.lock`.

## Goal

Rename `@craft-agent/shared` to `@rox-one/shared` across active package
metadata, workspace dependencies, TypeScript imports, dynamic imports, tsconfig
paths, build aliases, and the lockfile.

## Required UI

None.

## Required Data/API

None.

## Required Automations

None.

## Required Subagents

None required. Use direct repository search for the active reference map.

## TDD Requirements

Extend the R.5 package-scope regression test before implementation and confirm
it fails on the current `@craft-agent/shared` package name.

## Implementation Requirements

- Rename `packages/shared/package.json` `name` to `@rox-one/shared`.
- Rename active `@craft-agent/shared` workspace dependencies to
  `@rox-one/shared`.
- Rename active `@craft-agent/shared` imports and dynamic imports to
  `@rox-one/shared`.
- Rename active tsconfig path mappings and build-script aliases to the ROX
  scope.
- Refresh `bun.lock` with `bun install`.
- Do not rename app package names in this ticket; R.5.11 owns app scopes.
- Record compatibility-shim status explicitly without introducing unrelated
  runtime scope.

## Validation Commands

- `bun test scripts/__tests__/rebrand-package-scope.test.ts`
- `bun install`
- `bun install --frozen-lockfile`
- `bun run typecheck`
- `bun run lint`
- `bun test`
- `bun run build`
- `bun run validate:agent-contract`
- `bun run validate:docs`
- `git diff --check`
- `bun run validate:rebrand` (expected red until later rebrand phases)

## Acceptance Criteria

- [x] Ticket exists before code changes.
- [x] Red test proves the shared package-scope gap.
- [x] Shared package metadata uses `@rox-one/shared`.
- [x] Active shared dependencies, imports, paths, and aliases use
      `@rox-one/shared`.
- [x] Lockfile is refreshed.
- [x] Full suite passes after commit.
- [x] Build passes.
- [x] Validation evidence is recorded in the worklog.
- [x] Worklog complete after post-commit evidence is recorded.
- [x] Commit created.

## Worklog

Update `docs/worklog/T282-rebrand-pkg-scope-shared.md`.
