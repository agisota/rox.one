# T228 - RBAC admin UI

Status: DONE

## Context

We are building a white-label fork of Craft Agents OSS into Agent Workbench Suite.

Relevant product goals:

- local desktop app
- managed web/cloud app
- user/team workspaces
- prompt modes
- multi-agent workflows
- validation gates
- TDD-first implementation

T227 landed the four admin RPC handlers (`roles.list`, `roles.create`,
`roles.grant`, `roles.revoke`) with owner-gated mutation guards plus
`RoleStore`, `GrantStore` mutation methods, and the resolver cache-bust
hook. T228 introduces the operator-facing admin UI that consumes these
RPCs.

The UI is a new settings tab — "Team & permissions" — composed of three
panels:

- **Roles list** — renders `SYSTEM_ROLES` plus any custom roles returned
  by `roles.list`. System roles are flagged with a `(system)` badge and
  cannot be deleted.
- **Create role form** — visible only to owners. Submits a custom role
  (id, name, description, `systemManaged: false`) via `roles.create` and
  resets on success.
- **Grant management** — visible only to owners. Lists the current
  grants the caller can see, exposes a grant form (userId, roleId,
  scopeKind, scopeId), and a revoke button per grant that prompts a
  confirmation and refreshes the list.

Permission gating: before rendering the mutation forms, the panel calls
`roles.list` and `useIsOwner()` (a small renderer-side hook that
inspects the caller's grants via the existing account/auth surface) to
decide whether the caller has any `owner` grant. Non-owners see a
read-only catalog view with all mutation controls hidden and a
"You need owner role" notice.

The component layer ships under
`apps/electron/src/renderer/components/settings/rbac/` with a barrel
export. The settings page wire-in registers a new `permissions` (or
sibling) section in the existing settings navigator, reusing the
`SettingsCard`, `SettingsRow`, and `SettingsInput` primitives.

## Goal

Land a fully tested admin UI under
`apps/electron/src/renderer/components/settings/rbac/` that exercises
the four `roles.*` RPCs through an injectable `RpcClient`-shaped
context, wire it into the settings navigator as the "Team &
permissions" section, and keep `validate:rebrand` green. The
components must render correctly in static markup (the existing
`renderToStaticMarkup` + `bun:test` harness) and gate mutation forms
behind an owner-grant check.

## Required UI

- New `RolesPanel` top-level tab that loads `roles.list` and renders:
  - role table with `(system)` badges and disabled-delete state for
    system roles
  - empty/loading/error states
  - permission-denied banner when caller is not an owner
- `CreateRoleForm` with name + description + system-managed=false
  default; submits via `roles.create`; resets on success.
- `GrantRoleForm` with userId + roleId (dropdown) + scopeKind (dropdown)
  + scopeId; submits via `roles.grant`.
- `RevokeButton` per grant that confirms then calls `roles.revoke` and
  refreshes the grants list.
- `RolesPanelContext` provider that wraps the injected `RpcClient` for
  the components.
- Settings page wire-in: register `RolesSettingsPage` (the page
  wrapper) at `routes.view.settings('permissions')` (existing
  permissions tab is renamed to read-only file permissions inside the
  settings; the new "Team & permissions" tab gets a new slug).

## Required Data/API

- Consumes the four `roles.*` RPCs from T227. No new RPCs.
- Reads the caller's grants through `roles.list` plus an `RbacResolver`
  side-channel exposed by the host. For test isolation the components
  accept an injectable `RpcClient` (matching the existing
  `RpcClient` shape from `@rox-one/server-core/transport`).
- No new persistence.

## Required Automations

None.

## Required Subagents

None.

## TDD Requirements

Before implementation:

1. Write unit tests under
   `apps/electron/src/renderer/components/settings/rbac/__tests__/`
   covering each component using the existing `renderToStaticMarkup` +
   `bun:test` pattern and a fake `RpcClient` that resolves/rejects per
   case. At minimum:
   - `RolesPanel` renders a role table when `roles.list` resolves with
     `SYSTEM_ROLES` plus a custom role.
   - `RolesPanel` shows a loading skeleton while `roles.list` is in
     flight.
   - `RolesPanel` shows an error message when `roles.list` rejects.
   - `CreateRoleForm` builds the correct `Role` payload and submits it
     via the fake `RpcClient.invoke('roles.create', role)`.
   - `GrantRoleForm` builds the correct `RoleGrant` payload and submits
     it via the fake `RpcClient.invoke('roles.grant', grant)`.
   - `RevokeButton` prompts confirmation and submits via the fake
     `RpcClient.invoke('roles.revoke', grant)`.
   - Permission-denied path: when the caller is not an owner, mutation
     forms are not rendered and a "You need owner role" banner is
     shown.
   - Empty state: when the role store returns only `SYSTEM_ROLES`, the
     three system roles render with `(system)` badges and the delete
     control is disabled.
2. Run tests and confirm they fail because the components do not exist
   yet.

## Implementation Requirements

- Add files under `apps/electron/src/renderer/components/settings/rbac/`:
  - `RolesPanel.tsx`
  - `CreateRoleForm.tsx`
  - `GrantRoleForm.tsx`
  - `RevokeButton.tsx`
  - `RolesPanelContext.tsx`
  - `roles-panel-state.ts` (pure data shape + reducer; testable in
    isolation)
  - `index.ts` (barrel export)
- Wire `RolesPanel` into a new settings page
  `apps/electron/src/renderer/pages/settings/PermissionsSettingsPage.tsx`
  (extend or sibling the existing one) and register the page in
  `settings-pages.ts` plus the settings registry.
- Reuse the existing `SettingsCard`, `SettingsRow`, `SettingsInput`,
  `SettingsSection`, and `Button` primitives. Do not introduce new
  dependencies.
- The component layer must accept an injectable `RpcClient` via a
  `RolesPanelContext`. The settings page provides the adapter that
  calls `window.electronAPI`-equivalent or the renderer transport
  directly.

## Validation Commands

- `bun test apps/electron/src/renderer/components/settings/rbac/__tests__/`
- `bun test apps/electron/src/renderer/pages/settings/__tests__/team-permissions-settings-page.test.ts`
- `bun test packages/shared/src/i18n/__tests__/locale-parity.test.ts`
- `bun test packages/server-core/src/handlers/rpc/__tests__/roles.test.ts`
  (regression — must remain green)
- `bun run typecheck`
- `bun run validate:rebrand`
- `git diff --check`

## Acceptance Criteria

- [x] `RolesPanel` renders system + custom roles from `roles.list` with
      `(system)` badges and disabled-delete on system roles.
- [x] Loading state shown while `roles.list` is in flight.
- [x] Error state shown when `roles.list` rejects.
- [x] `CreateRoleForm` submits to `roles.create` and resets on success.
- [x] `GrantRoleForm` submits to `roles.grant`.
- [x] `RevokeButton` confirms then submits to `roles.revoke` and
      refreshes the grants list.
- [x] Permission-denied banner shown when caller is not owner;
      mutation forms hidden.
- [x] Empty state shows only `SYSTEM_ROLES`.
- [x] Settings page wire-in registers a "Team & permissions" entry in
      the settings navigator.
- [x] `bun test apps/electron/src/renderer/components/settings/rbac/__tests__/`
      exits green.
- [x] T227 `roles.test.ts` regression remains green.
- [x] `validate:rebrand` exits 0.
- [x] Worklog complete.
- [x] Commit created.

## Out of scope for this cycle

T229 (RBAC E2E) and T230 (ADR `0009-rbac-policy.md`) remain deferred.
Persisted (DB-backed) implementations of `RoleStore` and `GrantStore`
also defer to later phases.

## Worklog

Update `docs/worklog/T228-rbac-admin-ui.md`.
