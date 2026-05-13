# T273 - Rebrand test-fixtures package scope

Status: DONE

## Context

Phase R.5.1 starts the package-scope rename with the lowest-risk workspace
package: test fixtures. This package has no production runtime surface.

## Goal

Rename `@craft-agent/test-fixtures` to `@rox-one/test-fixtures` across package
metadata, lockfile, fixture docs/comments, and known test importers.

## Required UI

None.

## Required Data/API

None.

## Required Automations

None.

## Required Subagents

No subagent required; direct `rg` shows a bounded set of package metadata and
test-only import sites.

## TDD Requirements

Add a focused R.5 package-scope regression test before implementation and
confirm it fails on the existing test-fixtures scope.

## Implementation Requirements

- Rename `packages/test-fixtures/package.json` `name` to
  `@rox-one/test-fixtures`.
- Update `packages/shared/package.json` devDependency to the new scope.
- Update shared tests that import the fixture package.
- Update package README/source comments that name the scope.
- Refresh `bun.lock` with `bun install`.
- Do not rename any other package scope in this ticket.

## Validation Commands

- `bun test scripts/__tests__/rebrand-package-scope.test.ts`
- `bun install`
- `bun run typecheck`
- `bun run lint`
- `bun test packages/shared/tests/mode-manager.test.ts packages/shared/tests/mode-manager-bash-validation.test.ts`
- `bun test`
- `bun run build`
- `bun run validate:docs`
- `git diff --check`
- `bun run validate:rebrand` (expected red until later R.5/R.6/R.7 phases)

## Acceptance Criteria

- [x] Red test proves the test-fixtures package-scope gap.
- [x] Test-fixtures package metadata uses `@rox-one/test-fixtures`.
- [x] Known importers use `@rox-one/test-fixtures`.
- [x] Lockfile is refreshed.
- [x] Targeted shared tests pass.
- [x] Validation evidence is recorded in the worklog.
- [x] Worklog complete.
- [x] Commit created.

## Worklog

Update `docs/worklog/T273-rebrand-pkg-scope-test-fixtures.md`.
