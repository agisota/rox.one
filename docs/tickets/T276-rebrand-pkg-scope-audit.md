# T276 - Rebrand audit package scope

Status: DONE

## Context

Phase R.5.4 renames the audit workspace package after the core scope has
landed. Current repo lookup shows this package is not imported by active
runtime code yet; the slice is limited to package metadata and lockfile state.

## Goal

Rename `@craft-agent/audit` to `@rox-one/audit` across audit package metadata
and the lockfile.

## Required UI

None.

## Required Data/API

None.

## Required Automations

None.

## Required Subagents

No subagent required; direct `rg` shows only package metadata and lockfile
references for the audit scope.

## TDD Requirements

Extend the R.5 package-scope regression test before implementation and confirm
it fails on the current `@craft-agent/audit` package name.

## Implementation Requirements

- Rename `packages/audit/package.json` `name` to `@rox-one/audit`.
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

- [x] Red test proves the audit package-scope gap.
- [x] Audit package metadata uses `@rox-one/audit`.
- [x] Lockfile is refreshed.
- [x] Full suite passes after commit.
- [x] Build passes after commit.
- [x] Validation evidence is recorded in the worklog.
- [x] Worklog complete.
- [x] Commit created.

## Worklog

Update `docs/worklog/T276-rebrand-pkg-scope-audit.md`.
