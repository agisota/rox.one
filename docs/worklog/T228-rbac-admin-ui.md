# T228 - RBAC admin UI

## 1. Task summary

Land the operator-facing admin UI for the RBAC roles + grants
catalogue introduced in T227. The UI is composed of testable React
components under `apps/electron/src/renderer/components/settings/rbac/`
wired into a new "Team & permissions" settings tab. Components consume
the four `roles.*` RPCs (`list`, `create`, `grant`, `revoke`) through
an injectable `RpcClient`-shaped context. Owner-gating is enforced in
the renderer by inspecting the grants returned by the catalogue.

## 2. Repo context discovered

- The renderer test harness uses `bun:test` + `react-dom/server`'s
  `renderToStaticMarkup` (no happy-dom, no React Testing Library). Tests
  assert that produced markup contains expected strings. The existing
  `apps/electron/src/renderer/pages/settings/__tests__/` directory is
  the canonical settings-test home, but feature folders nest their own
  `__tests__` directories (e.g. `components/workbench/__tests__/`).
- Settings primitives (`SettingsCard`, `SettingsRow`, `SettingsInput`,
  `SettingsSection`) live in
  `apps/electron/src/renderer/components/settings/` and are imported
  via `@/components/settings`.
- The settings page registry is at
  `apps/electron/src/shared/settings-registry.ts` and the page-to-
  component map is at
  `apps/electron/src/renderer/pages/settings/settings-pages.ts`. Icons
  for the navigator live in `components/icons/SettingsIcons.tsx`.
- The renderer reaches the server through `window.electronAPI` and the
  `buildClientApi` proxy. T228 keeps the components transport-agnostic
  by accepting a minimal `RpcClient`-shaped object through
  `RolesPanelContext`; the page wrapper supplies the adapter.
- `RPC_CHANNELS.roles.{LIST,CREATE,GRANT,REVOKE}` are already declared
  in `packages/shared/src/protocol/channels.ts` and registered in
  `packages/shared/src/protocol/routing.ts` (REMOTE_ELIGIBLE).
- T227's `roles.ts` handlers return `{error, reason}` on failure (no
  throws). The UI surfaces these as inline banners.

## 3. Files inspected

- `docs/superpowers/goals/2026-05-13-agent-workbench-suite-master-roadmap-goal.md`
  (Phase 2 §4 work breakdown line 5).
- `docs/tickets/TEMPLATE.md`.
- `docs/worklog/T227-rbac-admin-rpc.md` (worklog template + structure).
- `packages/server-core/src/handlers/rpc/roles.ts`.
- `packages/shared/src/auth/roles-schema.ts` for `Role`, `RoleGrant`,
  `SYSTEM_ROLES`, `ActorKind`, `ScopeKind`.
- `packages/shared/src/protocol/channels.ts`,
  `packages/shared/src/protocol/routing.ts`.
- `apps/electron/src/renderer/pages/settings/AccountSettingsPage.tsx`,
  `AccountAuthPanel.tsx`, `LabelsSettingsPage.tsx`.
- `apps/electron/src/renderer/pages/settings/__tests__/account-auth-panel.test.tsx`
  for the static-markup test pattern.
- `apps/electron/src/renderer/components/settings/index.ts` (barrel
  exports for primitives).
- `apps/electron/src/shared/settings-registry.ts`,
  `apps/electron/src/shared/menu-schema.ts`,
  `apps/electron/src/renderer/pages/settings/settings-pages.ts`,
  `apps/electron/src/renderer/components/icons/SettingsIcons.tsx`.

## 4. Tests added first

Under
`apps/electron/src/renderer/components/settings/rbac/__tests__/`:

- `roles-panel.test.tsx`:
  - Renders system + custom roles as a table when `roles.list`
    resolves.
  - Loading state placeholder visible synchronously while `roles.list`
    pending.
  - Error message visible when `roles.list` rejects.
  - Permission-denied banner visible when caller has no `owner` grant;
    mutation forms hidden.
  - Empty state shows only the three `SYSTEM_ROLES` with `(system)`
    badges and disabled delete control.
- `create-role-form.test.tsx`:
  - Submits the expected `Role` payload via fake
    `RpcClient.invoke('roles.create', role)` with `systemManaged:
    false`.
- `grant-role-form.test.tsx`:
  - Submits the expected `RoleGrant` payload via fake
    `RpcClient.invoke('roles.grant', grant)` with sane defaults
    (`actorKind: 'user'`, `scopeKind: 'workspace'`).
- `revoke-button.test.tsx`:
  - Calls fake `RpcClient.invoke('roles.revoke', grant)` after
    confirmation; refresh callback fired on success.
- `roles-panel-state.test.ts`:
  - Pure-data reducer covers loading, success, error, refresh, and
    role-create/revoke flows.
- `apps/electron/src/renderer/pages/settings/__tests__/team-permissions-settings-page.test.ts`:
  - Verifies the `team-permissions` settings entry is present in the
    shared registry, menu schema, renderer icon map, route builder, and
    route parser. The full `settings-pages.ts` component map remains
    guarded by `bun run typecheck` because importing it directly under
    Bun pulls unrelated Vite-only theme glob code.
- `packages/shared/src/i18n/__tests__/locale-parity.test.ts`:
  - Existing parity test failed first because the new
    `settings.teamPermissions.*` keys existed only in English and were
    inserted out of sort order. This locked the locale repair before
    implementation closeout.

## 5. Expected failing test output

```
bun test v1.x

apps/electron/src/renderer/components/settings/rbac/__tests__/roles-panel.test.tsx:
error: Cannot find module '../RolesPanel' ...

apps/electron/src/renderer/components/settings/rbac/__tests__/create-role-form.test.tsx:
error: Cannot find module '../CreateRoleForm' ...

(same for grant-role-form, revoke-button, roles-panel-state)
```

## 6. Implementation changes

- Added `apps/electron/src/renderer/components/settings/rbac/`:
  - `roles-panel-state.ts` — pure data shape + reducer used by the
    panel.
  - `RolesPanelContext.tsx` — React context that exposes a minimal
    `RpcClient`-shaped object (`{invoke(channel, ...args)}`) plus the
    caller's `userId` for the `useIsOwner` derivation.
  - `RolesPanel.tsx` — top-level component. Loads `roles.list` on
    mount, renders the roles table, conditionally mounts the create
    form, and lists current grants with `RevokeButton`. Surfaces
    `{error, reason}` results as inline banners.
  - `CreateRoleForm.tsx` — controlled inputs for `id`, `name`,
    `description`; submits a `Role` payload with
    `systemManaged: false`.
  - `GrantRoleForm.tsx` — controlled inputs for `actorId`, `roleId`,
    `scopeKind`, `scopeId`; submits a `RoleGrant` payload.
  - `RevokeButton.tsx` — confirm-then-call wrapper around
    `roles.revoke`.
  - `index.ts` — barrel export of all of the above.
- Added the page wrapper
  `apps/electron/src/renderer/pages/settings/TeamPermissionsSettingsPage.tsx`
  that bridges `RolesPanel` to the renderer transport adapter (uses
  `window.electronAPI.invokeOnServer` if present, otherwise the local
  electronAPI bridge through a small dynamic-dispatch shim — kept
  internal to the page wrapper so tests of the panel never need a
  transport).
- Registered the new page in:
  - `apps/electron/src/shared/settings-registry.ts` (new entry
    `team-permissions` with `labelKey: 'settings.teamPermissions.title'`).
  - `apps/electron/src/renderer/pages/settings/settings-pages.ts` (page
    map).
  - `apps/electron/src/renderer/components/icons/SettingsIcons.tsx`
    (icon reuse — keeps existing shield icon for the new entry).
  - `apps/electron/src/shared/menu-schema.ts` (AppMenu icon metadata).
  - `apps/electron/src/renderer/pages/settings/index.ts` (barrel export).
- Added `settings.teamPermissions.title` and
  `settings.teamPermissions.description` to every locale
  (`en`, `ru`, `zh-Hans`, `pl`, `ja`, `hu`, `es`, `de`) in sorted key
  order so locale parity remains green.
- Added the focused settings registration test described in Section 4.

## 7. Validation commands run

- `bun test apps/electron/src/renderer/components/settings/rbac/__tests__/`
- `bun test apps/electron/src/renderer/pages/settings/__tests__/team-permissions-settings-page.test.ts`
- `bun test packages/shared/src/i18n/__tests__/locale-parity.test.ts`
- `bun test packages/server-core/src/handlers/rpc/__tests__/roles.test.ts`
- `bun test apps/electron/src/renderer/components/settings/rbac/__tests__/ apps/electron/src/renderer/pages/settings/__tests__/team-permissions-settings-page.test.ts packages/shared/src/i18n/__tests__/locale-parity.test.ts packages/server-core/src/handlers/rpc/__tests__/roles.test.ts`
- `bun run typecheck`
- `bun run lint`
- `bun run validate:rebrand`
- `bun run build`
- `git diff --check`

## 8. Passing test output summary

```
$ bun test apps/electron/src/renderer/components/settings/rbac/__tests__/
26 pass, 0 fail, 62 expect() calls

$ bun test apps/electron/src/renderer/pages/settings/__tests__/team-permissions-settings-page.test.ts \
    apps/electron/src/renderer/components/settings/rbac/__tests__/
27 pass, 0 fail, 68 expect() calls

$ bun test packages/shared/src/i18n/__tests__/locale-parity.test.ts
37 pass, 0 fail, 29 expect() calls

$ bun test apps/electron/src/renderer/components/settings/rbac/__tests__/ \
    apps/electron/src/renderer/pages/settings/__tests__/team-permissions-settings-page.test.ts \
    packages/shared/src/i18n/__tests__/locale-parity.test.ts \
    packages/server-core/src/handlers/rpc/__tests__/roles.test.ts
94 pass, 0 fail, 131 expect() calls

$ bun run validate:rebrand
rebrand validation passed: no forbidden tokens outside the allowlist

$ bun run typecheck
exit 0

$ bun run lint
exit 0

$ git diff --check
clean
```

## 9. Build output summary

```
$ bun run build
electron main/preload/renderer/resources/assets build completed successfully.
Known Vite warning only: some chunks are larger than 500 kB after minification.
```

## 10. Remaining risks

- The `useIsOwner` derivation is purely client-side: it inspects the
  grants the caller can see and decides whether to render mutation
  forms. The server still gates mutations (T227's owner check). UI
  hiding is a UX nicety, not a security boundary.
- The grant table renders only `actorKind === 'user'` rows in this
  cycle. Team-actor grants surface in a follow-up once the team-grant
  flow lands.
- The transport adapter inside the page wrapper uses `invokeOnServer`
  with a synthetic `(url, token, channel, args)` quartet pulled from
  the active workspace context. Hosts that run without a workspace
  (rare today) will see the panel render but mutation calls will
  short-circuit with `rbac-not-configured` until a workspace is
  attached.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| `RolesPanel` renders system + custom roles | Green | `roles-panel.test.tsx` |
| Loading state visible | Green | `roles-panel.test.tsx` |
| Error state visible | Green | `roles-panel.test.tsx` |
| `CreateRoleForm` submits to `roles.create` | Green | `create-role-form.test.tsx` |
| `GrantRoleForm` submits to `roles.grant` | Green | `grant-role-form.test.tsx` |
| `RevokeButton` confirms + submits to `roles.revoke` | Green | `revoke-button.test.tsx` |
| Permission-denied banner | Green | `roles-panel.test.tsx` |
| Empty state with `(system)` badges | Green | `roles-panel.test.tsx` |
| Settings nav wire-in | Green | `team-permissions-settings-page.test.ts` + typecheck |
| Locale parity for settings label keys | Green | `locale-parity.test.ts`, 37/37 pass |
| T227 RPC regression remains green | Green | `roles.test.ts`, 30/30 pass |
| `validate:rebrand` exits 0 | Green | Section 8 |
| Typecheck exits 0 | Green | Section 8 |
| Lint exits 0 | Green | Section 7 |
| Build exits 0 | Green | Section 9 |
| Worklog complete | Green | All 11 sections present |
| Commit created | Green | Atomic commits per Lore protocol |
