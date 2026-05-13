# T278 - Rebrand session MCP server package scope

Status: DONE

## Context

Phase R.5.6 renames the session MCP server workspace package after the session
tools core rename has landed. Current repo lookup shows this package scope is
limited to package metadata and the lockfile.

## Goal

Rename `@craft-agent/session-mcp-server` to `@rox-one/session-mcp-server`
across session MCP server package metadata and the lockfile.

## Required UI

None.

## Required Data/API

None.

## Required Automations

None.

## Required Subagents

No subagent required; direct `rg` shows only package metadata and lockfile
references for the session MCP server scope.

## TDD Requirements

Extend the R.5 package-scope regression test before implementation and confirm
it fails on the current `@craft-agent/session-mcp-server` package name.

## Implementation Requirements

- Rename `packages/session-mcp-server/package.json` `name` to
  `@rox-one/session-mcp-server`.
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
- [x] Red test proves the session MCP server package-scope gap.
- [x] Session MCP server package metadata uses `@rox-one/session-mcp-server`.
- [x] Lockfile is refreshed.
- [x] Full suite passes after commit.
- [x] Build passes after commit.
- [x] Validation evidence is recorded in the worklog.
- [x] Worklog complete.
- [x] Commit created.

## Worklog

Update `docs/worklog/T278-rebrand-pkg-scope-session-mcp-server.md`.
