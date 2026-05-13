# T224 - RBAC roles schema

Status: DONE

## Context

We are building a white-label fork of Rox Agents OSS into Agent Workbench Suite.

Relevant product goals:

- local desktop app
- managed web/cloud app
- user/team workspaces
- prompt modes
- multi-agent workflows
- validation gates
- TDD-first implementation

Phase M.2 introduces the RBAC slice that produces `session.permittedWorkspaces`,
which `deriveScopeFromAuth` already consumes (ADR
`0007-multi-tenant-storage-isolation`). T224 is the **types-only** foundation
for that slice: it defines the role and role-grant shapes that the policy
engine (T225) evaluates and that later tickets persist and edit.

## Goal

Land the TypeScript types and the system-managed role registry that the rest
of the M.2 RBAC slice depends on, without persistence and without changing any
RPC handler or storage adapter.

## Required UI

None.

## Required Data/API

- `Role` interface: `id`, `name`, `description?`, `systemManaged`.
- `RoleGrant` interface: `roleId`, `actorKind`, `actorId`, `scopeKind`, `scopeId`.
- Supporting unions: `ActorKind` (`'user' | 'team'`), `ScopeKind`
  (`'workspace' | 'org' | 'global'`), `RbacAction` (`'read' | 'write' | 'admin'`).
- `SYSTEM_ROLES` constant: frozen array of exactly three entries (`owner`,
  `editor`, `viewer`), every entry `systemManaged: true`.
- `isSystemRole(role)` helper.

## Required Automations

None for T224. Automation integration arrives when persistence and admin RPC
land (T226-T227).

## Required Subagents

None. The change is a single new file plus its test, in an area where the
existing auth module layout is already known.

## TDD Requirements

Before implementation:

1. Write unit tests in `packages/shared/src/auth/__tests__/roles-schema.test.ts`.
2. Run the tests and confirm they fail because the module does not yet exist.
3. Implement the minimum module needed to make them pass.

## Implementation Requirements

- Add `packages/shared/src/auth/roles-schema.ts` exporting `Role`, `RoleGrant`,
  `ActorKind`, `ScopeKind`, `RbacAction`, `SYSTEM_ROLES`, `isSystemRole`.
- Freeze `SYSTEM_ROLES` and each of its entries so callers cannot mutate the
  built-in registry.
- Wire the new module into `packages/shared/src/auth/index.ts` and add a
  subpath export entry in `packages/shared/package.json`.
- No database migration. No persistence layer. No RPC handler edits.

## Validation Commands

- `bun test packages/shared/src/auth/__tests__/roles-schema.test.ts`
- `bun run validate:rebrand` must still exit 0
- `git diff --check`

## Acceptance Criteria

- [x] `Role`, `RoleGrant`, and supporting unions exported with the documented fields.
- [x] `SYSTEM_ROLES` exports exactly three entries (`owner`, `editor`, `viewer`).
- [x] Every `SYSTEM_ROLES` entry has `systemManaged: true`.
- [x] `isSystemRole` returns `true` for the three system role ids and `false`
      for user-defined ids.
- [x] Unit tests pass.
- [x] `validate:rebrand` exits 0.
- [x] No runtime handler or storage file is touched by this ticket.
- [x] Worklog complete.
- [x] Commit created.

## Out of scope for this cycle

T226, T227, T228, T229, and T230 are explicitly deferred to subsequent cycles.
T224 lands the types-only foundation. The persistence layer, RPC handlers,
admin UI, integration tests, and ADR ship later. In particular, this ticket
does **not** edit `packages/server-core/src/handlers/rpc/account-ownership.ts`
or `packages/server-core/src/accounts/AccountStore.ts`.

## Worklog

Update `docs/worklog/T224-rbac-roles-schema.md`.
