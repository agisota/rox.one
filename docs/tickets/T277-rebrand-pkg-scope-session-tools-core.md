# T277 - Rebrand session tools core package scope

Status: DONE

## Context

Phase R.5.5 renames the session tools core workspace package after the audit
package rename has landed. Current repo lookup shows active importers in
`packages/session-mcp-server` and `packages/shared`, plus package metadata and
the lockfile.

## Goal

Rename `@craft-agent/session-tools-core` to `@rox-one/session-tools-core`
across active package metadata, TypeScript import sites, and the lockfile.

## Required UI

None.

## Required Data/API

None.

## Required Automations

None.

## Required Subagents

No subagent required; direct `rg` gives a bounded active importer set for this
package-scope slice.

## TDD Requirements

Extend the R.5 package-scope regression test before implementation and confirm
it fails on the current `@craft-agent/session-tools-core` package name.

## Implementation Requirements

- Rename `packages/session-tools-core/package.json` `name` to
  `@rox-one/session-tools-core`.
- Update active importers and dependency metadata in `packages/session-mcp-server`
  and `packages/shared`.
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

- [x] Ticket exists before code changes.
- [x] Red test proves the session tools core package-scope gap.
- [x] Session tools core package metadata uses `@rox-one/session-tools-core`.
- [x] Active importers and dependency metadata use the ROX scope.
- [x] Lockfile is refreshed.
- [x] Full suite passes after commit.
- [x] Build passes after commit.
- [x] Validation evidence is recorded in the worklog.
- [x] Worklog complete.
- [x] Commit created.

## Worklog

Update `docs/worklog/T277-rebrand-pkg-scope-session-tools-core.md`.
