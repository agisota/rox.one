# T274 - Rebrand UI package scope

Status: DONE

## Context

Phase R.5.2 renames the shared UI workspace package after the test-fixtures
scope has landed. UI is consumed by Electron, webui, and viewer surfaces, so the
rename must stay isolated from the remaining package-scope phases.

## Goal

Rename `@rox-agent/ui` to `@rox-one/ui` across UI package metadata, app
workspace dependencies, import/export sites, Vite/Vitest config references,
style subpath imports, comments, and the lockfile.

## Required UI

None.

## Required Data/API

None.

## Required Automations

None.

## Required Subagents

No subagent required; direct `rg` shows a bounded package/import surface for
the UI scope.

## TDD Requirements

Extend the R.5 package-scope regression test before implementation and confirm
it fails on the current `@rox-agent/ui` package name.

## Implementation Requirements

- Rename `packages/ui/package.json` `name` to `@rox-one/ui`.
- Update Electron, webui, and viewer workspace dependencies to
  `@rox-one/ui`.
- Update active imports, subpath imports, style imports, Vite/Vitest config
  references, and package comments from `@rox-agent/ui` to `@rox-one/ui`.
- Refresh `bun.lock` with `bun install`.
- Do not rename any other package scope in this ticket.

## Validation Commands

- `bun test scripts/__tests__/rebrand-package-scope.test.ts`
- `bun install`
- `bun run typecheck`
- `bun run lint`
- `bun test`
- `bun run build`
- `bun run validate:docs`
- `git diff --check`
- `bun run validate:rebrand` (expected red until later R.5/R.6/R.7 phases)

## Acceptance Criteria

- [x] Red test proves the UI package-scope gap.
- [x] UI package metadata uses `@rox-one/ui`.
- [x] App dependencies use `@rox-one/ui`.
- [x] Active imports and subpath/style imports use `@rox-one/ui`.
- [x] Lockfile is refreshed.
- [x] Full suite passes after commit.
- [x] Build passes after commit.
- [x] Validation evidence is recorded in the worklog.
- [x] Worklog complete.
- [x] Commit created.

## Worklog

Update `docs/worklog/T274-rebrand-pkg-scope-ui.md`.
