# T280 - Rebrand Pi agent server package scope

Status: DONE

## Context

Phase R.5.8 renames the Pi agent server workspace package after the messaging
package scopes have landed. Current repo lookup shows this package scope is
limited to package metadata and the lockfile.

## Goal

Rename `@craft-agent/pi-agent-server` to `@rox-one/pi-agent-server` across Pi
agent server package metadata and the lockfile.

## Required UI

None.

## Required Data/API

None.

## Required Automations

None.

## Required Subagents

No subagent required; direct `rg` shows only package metadata and lockfile
references for the Pi agent server scope.

## TDD Requirements

Extend the R.5 package-scope regression test before implementation and confirm
it fails on the current `@craft-agent/pi-agent-server` package name.

## Implementation Requirements

- Rename `packages/pi-agent-server/package.json` `name` to
  `@rox-one/pi-agent-server`.
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
- [x] Red test proves the Pi agent server package-scope gap.
- [x] Pi agent server package metadata uses `@rox-one/pi-agent-server`.
- [x] Lockfile is refreshed.
- [x] Full suite passes after commit.
- [x] Build passes.
- [x] Validation evidence is recorded in the worklog.
- [x] Worklog complete.
- [x] Commit created.

## Worklog

Update `docs/worklog/T280-rebrand-pkg-scope-pi-agent-server.md`.
