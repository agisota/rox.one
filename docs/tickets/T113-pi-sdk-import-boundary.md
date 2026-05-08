# T113 - PI SDK Import Boundary

Status: DONE

## Context

T108 blocks PI subprocess startup in `public-untrusted` mode, T112 blocks
server-core PI provider model discovery and GitHub Copilot OAuth before direct
SDK invocation, but the shared config barrel still re-exports `models-pi`.
That means broad imports from `@rox-agent/shared/config` can evaluate the PI
SDK model-discovery module even when the caller only needs generic config APIs.

## Goal

Keep PI SDK model-discovery code behind an explicit deep import boundary so
general config imports do not transitively load `@mariozechner/pi-ai`.

## Required UI

No UI change.

## Required Data/API

- Preserve PI model/provider discovery for Electron main and server-side callers.
- Add an explicit `@rox-agent/shared/config/models-pi` package export.
- Remove `models-pi` from the broad `@rox-agent/shared/config` barrel.
- Update PI-only consumers to import the deep models-pi subpath.
- Keep renderer-facing config imports free of PI SDK model-discovery imports.
- Do not change dependency versions, package manifests beyond the export map, or
  lockfiles.

## Required Automations

- Add a static contract test that fails while the config barrel exports
  `models-pi`.
- Keep release risk evidence synced with the new guard ticket.

## Required Subagents

No subagent required: this is a bounded import-boundary slice.

## TDD Requirements

Before implementation:

1. Add the PI SDK import-boundary contract test.
2. Run the focused test and confirm the expected red failure.

## Implementation Requirements

- Move PI SDK discovery exports out of the broad config barrel.
- Keep server-core PI provider discovery dynamic and guarded.
- Keep Electron main's PI resolver wired through a server/main-only deep import.
- Preserve existing runtime behavior outside the import boundary.

## Validation Commands

- `bun test scripts/__tests__/pi-sdk-import-boundary-contract.test.ts`
- `bun test scripts/__tests__/dependency-risk-register-contract.test.ts`
- `bun test packages/server-core/src/domain/connection-setup-logic.test.ts`
- `cd packages/server-core && bun run typecheck`
- `cd packages/shared && bun run test src/agent/__tests__/pi-agent-dependency-risk.test.ts src/agent/backend/internal/drivers/pi.test.ts`
- `bun run validate:docs`
- `git diff --check`
- `git diff --name-only | rg '(^|/)(bun\.lock|bun\.lockb|pnpm-lock\.yaml|package-lock\.json|yarn\.lock)$' || true`

## Acceptance Criteria

| Criteria | Status |
|---|---|
| Import-boundary test fails before implementation and passes after | DONE |
| `@rox-agent/shared/config` no longer exports `models-pi` | DONE |
| `@rox-agent/shared/config/models-pi` is exported explicitly | DONE |
| Electron main PI resolver imports models-pi through the deep subpath | DONE |
| Server-core PI discovery dynamic imports use the deep subpath after the public guard | DONE |
| Dependency risk evidence references T113 | DONE |
| Lockfiles remain unchanged | DONE |
| Docs validation passes | DONE |
| Worklog complete | DONE |
| Scoped Lore commit exists | DONE |

## Worklog

Update `docs/worklog/T113-pi-sdk-import-boundary.md`.
