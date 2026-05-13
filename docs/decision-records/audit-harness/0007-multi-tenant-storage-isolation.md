# Decision 0007: Multi-Tenant Storage Isolation

- Status: accepted
- Date: 2026-05-13
- Implements: ADR 0005's reserved `kind: 'workspace'` arm of `WorkspaceScope`

## Canonical

`WorkspaceScope` remains the public discriminated union, but storage submodules
now accept `BrandedWorkspaceScope`. The nominal brand is owned exclusively by
`packages/shared/src/config/storage-scope-auth.ts`. The private brand symbol and
the `brand()` applier are not exported.

`DEFAULT_LOCAL_SCOPE` and `deriveScopeFromAuth(session, requestedWorkspaceId)`
are the only producers of branded values:

- Single-user runtime, the default, always returns `DEFAULT_LOCAL_SCOPE`.
  If a request carried a non-empty `requestedWorkspaceId`, the factory emits
  trace-level `scope.factory.downgraded`.
- Multi-tenant runtime is opt-in via `ROX_MULTI_TENANT=1`.
  A non-empty requested workspace must be present in
  `session.permittedWorkspaces`. Permitted requests receive a branded
  `kind: 'workspace'` scope. Rejected requests throw
  `MultiTenantForgeryError` and emit warn-level
  `scope.factory.forgery_rejected`.
- Null or empty requested workspace ids resolve to `DEFAULT_LOCAL_SCOPE`.

`storage-internal.getConfigDirForScope(scope)` is the only storage-root
resolver:

- `kind: 'local-single-user'` resolves to the existing flat `<configDir>/...`
  layout.
- `kind: 'workspace'` with `ROX_MULTI_TENANT=1` resolves to
  `<configDir>/tenants/<workspaceId>/...`.
- `kind: 'workspace'` without multi-tenant activation downgrades to the flat
  root and emits warn-level `scope.runtime.workspace_downgraded`.

Storage also performs a defense-in-depth brand check. A scope-shaped value that
reaches storage without the private brand throws `BrandedScopeBreachError` and
emits `scope.brand.cast_breach`. This catches unsafe `as BrandedWorkspaceScope`
casts at runtime.

One demo caller, `packages/server-core/src/handlers/rpc/workspace.ts`'s
`workspaces.GET` handler, derives a scope from the trusted request context and
`ctx.workspaceId` before reading workspaces. Sibling handlers remain on
`DEFAULT_LOCAL_SCOPE` and carry `// TODO(C4): use deriveScopeFromAuth when ready`
markers for follow-up slices.

## Why

- **Forgery defense is both compile-time and runtime.** Unbranded literals are
  not assignable to storage submodule parameters. Unsafe casts still trip the
  brand check before path resolution.
- **Single-user layout does not move.** `DEFAULT_LOCAL_SCOPE` resolves to the
  same flat config directory that existed before C4. Existing installs require
  no migration while multi-tenant runtime is disabled.
- **Multi-tenant behavior is explicitly gated.** Operators must set
  `ROX_MULTI_TENANT=1` before workspace scopes resolve to tenant-prefixed
  paths. Until then, the factory and resolver downgrade to the flat store.
- **The auth factory is the minting choke point.** Keeping the private brand,
  `DEFAULT_LOCAL_SCOPE`, and `deriveScopeFromAuth` in one module prevents
  ad hoc scope construction from spreading through renderer, webui, or
  bootstrap code.
- **Path isolation has one resolver.** The eight storage submodules all route
  storage roots through `getConfigDirForScope()`, reducing cross-tenant write
  risk to one audited boundary.

## Out of scope

Deferred follow-up slices:

- **Per-tenant credential key derivation.** C4 provides path-prefix isolation
  only. `credentials/manager.ts` still uses the existing encryption substrate;
  a future slice can derive tenant keys from the master key and workspace id.
- **RBAC-owned `session.permittedWorkspaces` population.** C4 consumes the
  permitted workspace set but does not define role or team policy. That belongs
  to the RBAC slice.
- **Pi-agent-server IPC scope propagation.** Subprocesses continue to see
  local-single-user storage. Cross-process scope serialization and integrity are
  separate design problems.
- **Data migration tooling.** Operators enabling `ROX_MULTI_TENANT=1` for
  existing flat data need a migration tool to copy or move files into
  `<configDir>/tenants/<workspaceId>/...`.
- **Queryable audit storage.** C4 emits structured logger events. Search,
  retention, and tamper-resistant audit storage are future work.
- **Remaining webui handler migrations.** Only `workspace.ts:workspaces.GET` is
  wired through `deriveScopeFromAuth` in this slice. Other handlers are marked
  with C4 TODOs.
- **Electron handler migrations.** `apps/electron/src/main/handlers/*` remain
  `DEFAULT_LOCAL_SCOPE` headless/no-session paths for C4.

## Security Implications

- **Workspace-id forgery.** Request bodies and renderer/webui inputs do not mint
  scopes. The server-side factory validates requested workspace ids against the
  trusted permitted set before returning a branded workspace scope.
- **Scope leakage across requests.** `DEFAULT_LOCAL_SCOPE` is frozen and safe to
  share. Workspace scopes are constructed per request by `deriveScopeFromAuth`
  and are not cached on shared state.
- **Storage-root mixing.** All tenant path construction is centralized in
  `getConfigDirForScope()`. Submodules no longer call `getConfigDir()` directly
  for scoped storage roots.
- **Audit coverage.** The implemented audit surface covers factory downgrades,
  forgery rejection, workspace-scope runtime downgrades, and unbranded
  storage-bound scope breaches. Read-event audit is intentionally deferred.

## Verification Gates

- `packages/shared/src/config/__tests__/storage-scope-auth.test.ts` covers
  brand non-export, factory downgrade, permitted workspace minting, and forgery
  rejection.
- `packages/shared/src/config/__tests__/storage-scope-runtime.test.ts` covers
  `ROX_MULTI_TENANT` activation and test overrides.
- `packages/shared/src/config/__tests__/storage-scope.test.ts` covers flat
  default path resolution, tenant-prefixed resolution, inactive downgrade,
  cast-breach audit, and branded storage call-site typing.
- `packages/server-core/src/handlers/rpc/__tests__/workspace-scope.test.ts`
  covers the demo RPC caller in single-user and multi-tenant modes.
