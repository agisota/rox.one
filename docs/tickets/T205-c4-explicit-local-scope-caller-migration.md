# T205 - C4 explicit local scope caller migration

Status: DONE

## Context

We are building a white-label fork of Craft Agents OSS into Agent Workbench Suite.

Relevant product goals:

- managed web/cloud app
- user/team workspaces
- validation gates
- TDD-first implementation

## Goal

Migrate the C4 caller-migration files to pass `DEFAULT_LOCAL_SCOPE` explicitly for headless/no-session storage calls while preserving the existing flat single-user runtime layout.

## Required UI

None.

## Required Data/API

- Replace omitted storage-submodule scope arguments in the design spec's caller migration files with `DEFAULT_LOCAL_SCOPE`.
- Keep `apps/electron/src/main/handlers/*` untouched.
- Do not wire `deriveScopeFromAuth` here; the demo RPC handler is a separate ticket.

## Required Automations

None.

## Required Subagents

Use a read-only explorer to map candidate call sites inside the spec-approved caller migration files.

## TDD Requirements

Before implementation:

1. Run package typechecks after T204 narrowing to establish the current caller state.
2. Record that no structural local-scope literals remain; this migration is explicitness enforcement rather than failing-error repair.

## Implementation Requirements

Stay within the design spec's caller migration list:

- `packages/shared/{agent,auth,credentials,config/{watcher,validators,proxy-env,preferences},workspaces/storage}.ts`
- `apps/electron/src/main/{index,onboarding,power-manager,network-proxy,browser-pane-manager,auto-update}.ts`
- `packages/server/src/index.ts`
- `packages/server-core/src/webui/http-server.ts`

## Validation Commands

- `bun run typecheck`
- targeted package typechecks if needed while editing

## Acceptance Criteria

- [x] Spec-approved caller migration files pass `DEFAULT_LOCAL_SCOPE` explicitly for storage submodule calls.
- [x] No out-of-scope Electron handler files are modified.
- [x] Typecheck passes.
- [x] Worklog complete.
- [x] Commit created.

## Worklog

Update `docs/worklog/T205-c4-explicit-local-scope-caller-migration.md`.
