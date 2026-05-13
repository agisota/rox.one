# T214 - C4 Electron main handlers scope migration

Status: DONE

## Context

We are building a white-label fork of Rox Agents OSS into Agent Workbench Suite.

Relevant product goals:

- managed web/cloud app
- user/team workspaces
- multi-tenant storage isolation
- validation gates
- TDD-first implementation

## Goal

Audit and migrate `apps/electron/src/main/handlers/*` storage calls so
session-carrying handlers use authenticated branded scope and genuinely
headless Electron settings remain explicitly documented as global local
storage.

## Required UI

None.

## Required Data/API

- Do not change user-visible behavior for machine-wide Electron settings.
- Keep Git Bash, update-dismissal, notification preference, and power
  keep-awake persistence global/local unless a handler actually carries
  tenant-bound storage semantics.
- Any future Electron main handler storage call must avoid direct
  `DEFAULT_LOCAL_SCOPE` use and choose either authenticated scope derivation or
  the explicit global storage helper.

## Required Automations

None.

## Required Subagents

Use read-only Electron handler and test-harness explorers before
implementation.

## TDD Requirements

Before implementation:

1. Add regression coverage for Electron main handler storage scope decisions.
2. Confirm the test fails because handlers still pass `DEFAULT_LOCAL_SCOPE`
   directly rather than a documented headless/global storage helper.
3. Include multi-tenant behavior coverage showing global Electron settings do
   not write tenant-prefixed config.

## Implementation Requirements

- Add a small Electron handler-local global storage scope helper.
- Replace direct `DEFAULT_LOCAL_SCOPE` call arguments in Electron handler
  storage calls with that helper.
- Do not migrate global machine settings into tenant storage.
- Do not modify server-core workspace RPC handlers in this ticket.

## Validation Commands

- `bun test apps/electron/src/main/handlers/__tests__/electron-global-storage-scope.test.ts`
- `bun test apps/electron/src/main/handlers/__tests__/registration.test.ts apps/electron/src/main/handlers/__tests__/registration-profiles.test.ts apps/electron/src/main/handlers/__tests__/settings-default-thinking.test.ts`
- `bun run typecheck`
- `bun run lint`
- `bun test`
- `bun run build`
- `bun run validate:agent-contract`
- `bun run validate:docs`
- `git diff --check`

## Acceptance Criteria

- [x] Every Electron main handler storage callsite is mapped in the worklog.
- [x] Session-carrying Electron main storage handlers are either migrated or
      proven absent.
- [x] Genuinely headless/global Electron settings use an explicit documented
      global storage scope helper.
- [x] Multi-tenant tests prove those global settings stay in flat local config
      and do not write tenant-prefixed storage.
- [x] Targeted Electron handler tests pass.
- [x] Full relevant validation passes or blockers are documented.
- [x] Worklog complete.
- [x] Commit created.

## Worklog

Update `docs/worklog/T214-c4-electron-main-handlers-scope-migration.md`.
