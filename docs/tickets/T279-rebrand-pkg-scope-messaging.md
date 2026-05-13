# T279 - Rebrand messaging package scopes

Status: DONE

## Context

Phase R.5.7 renames the messaging gateway package and its WhatsApp worker
companion after the session MCP server scope rename has landed. Current repo
lookup shows references in package metadata, runtime imports, active package
comments, and the lockfile.

## Goal

Rename `@rox-agent/messaging-gateway` and
`@rox-agent/messaging-whatsapp-worker` to their `@rox-one/*` package scopes.

## Required UI

None.

## Required Data/API

None.

## Required Automations

None.

## Required Subagents

No subagent required; direct `rg` produced a bounded active-reference list for
the two messaging package scopes.

## TDD Requirements

Extend the R.5 package-scope regression test before implementation and confirm
it fails on the current legacy messaging package names.

## Implementation Requirements

- Rename `packages/messaging-gateway/package.json` `name` to
  `@rox-one/messaging-gateway`.
- Rename `packages/messaging-whatsapp-worker/package.json` `name` to
  `@rox-one/messaging-whatsapp-worker`.
- Update active imports, workspace dependencies, and package-scope comments for
  those two package names.
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
- [x] Red test proves the messaging package-scope gap.
- [x] Messaging gateway package metadata uses `@rox-one/messaging-gateway`.
- [x] WhatsApp worker package metadata uses `@rox-one/messaging-whatsapp-worker`.
- [x] Active imports and workspace dependencies use ROX package scopes.
- [x] Lockfile is refreshed.
- [x] Full suite passes after commit.
- [x] Build passes.
- [x] Validation evidence is recorded in the worklog.
- [x] Worklog complete.
- [x] Commit created.

## Worklog

Update `docs/worklog/T279-rebrand-pkg-scope-messaging.md`.
