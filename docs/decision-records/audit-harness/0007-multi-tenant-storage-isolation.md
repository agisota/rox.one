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

## Follow-up Status

The original C4 slice intentionally deferred storage-adjacent follow-ups. Phase
1 has now implemented those follow-ups:

- **Remaining workspace RPC migrations.** Implemented by T213 (`8c1edf9`).
  Every former C4 TODO in `workspace.ts` derives scope from trusted request
  context and has flat, tenant, and forgery coverage.
- **Electron main handler scope migration.** Implemented by T214 (`9b29b30`).
  Electron main storage calls now use an explicit named global scope for
  machine-wide handlers, with session-carrying storage moved through the
  server-core scoped RPC surface.
- **Server-core non-workspace RPC scope decisions.** Implemented by T215
  (`ee47a29`). App/admin-global RPC handlers now use explicit global scope
  helpers instead of ad hoc local scope literals.
- **Pi-agent-server IPC scope propagation.** Implemented by T216 (`5e8b17a`).
  The Pi subprocess receives an authenticated storage-scope envelope and
  re-mints scope through the same trusted factory boundary.
- **Per-tenant credential key derivation.** Implemented by T217 (`baee220`).
  Active tenant credential stores derive tenant keys from the local master key
  with workspace-id scoped HKDF metadata while single-user credentials remain
  compatible.
- **Queryable audit storage.** Implemented by T218 through T221 (`1e3c76e`,
  `1f69afc`, `28cc2a2`, `ee49153`). ADR 0008 records the append-only audit
  schema, structured writer fanout, query API, and retention policy.
- **Data migration tooling.** Implemented by T222 (`9ffb0a3`). Operators can
  dry-run, apply, and rollback local flat-to-tenant-prefixed data migration
  with checksums, snapshots, a write lock, and idempotent reruns.

Still out of scope for ADR 0007:

- **RBAC-owned `session.permittedWorkspaces` population.** C4 consumes the
  permitted workspace set but does not define role or team policy. Phase 2 owns
  the RBAC policy model and session population path.

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
  forgery rejection, workspace-scope runtime downgrades, unbranded
  storage-bound scope breaches, tenant credential access signals, queryable
  audit storage, and explicit retention evaluation.

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
