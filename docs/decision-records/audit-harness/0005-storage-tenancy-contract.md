# Decision 0005: Storage Tenancy Contract

- Status: accepted
- Date: 2026-05-09

## Canonical

Every public function exported by the eight `packages/shared/src/config/storage-*.ts` submodules accepts an optional last-position parameter:

```ts
_scope: WorkspaceScope = DEFAULT_LOCAL_SCOPE
```

`WorkspaceScope` is a discriminated union defined in `packages/shared/src/config/storage-scope.ts` and re-exported from the storage barrel:

```ts
export type WorkspaceScope =
  | { readonly kind: 'local-single-user' }
  | { readonly kind: 'workspace'; readonly workspaceId: string };

export const DEFAULT_LOCAL_SCOPE: WorkspaceScope =
  Object.freeze({ kind: 'local-single-user' });

export function workspaceIdFromScope(scope: WorkspaceScope): string | undefined;
```

Today the parameter is accepted but ignored — the contract is widening only. ADR 0002 reserved tenancy as out of scope for the original split; this decision closes that loop.

## Why

- **A single widening choke point.** When a future multi-tenant or workspace-isolated storage backend ships, the new behavior swaps in behind one parameter on every persistence call. Callers don't need a separate API; the tenant-aware code path is the same surface, narrowed by the `kind: 'workspace'` arm of the union.
- **Discriminated union mirrors the existing app/workspace split.** `StoredConfig` already tracks app-level fields (color theme, notifications, default thinking level) separately from per-workspace fields (`workspaces[]`). Per-workspace functions in `storage-conversations.ts`, `storage-drafts.ts`, and `storage-workspaces.ts` already accept `workspaceId: string` as the *content* address; `WorkspaceScope` adds the *tenant* address as a parallel axis without conflating the two.
- **Default parameter keeps every commit shippable.** The 28 known importers of `'@craft-agent/shared/config/storage'` continue to compile unchanged after the signature widening. Migration of call sites to pass `DEFAULT_LOCAL_SCOPE` explicitly is mechanical and incremental — no big-bang flip.
- **`Object.freeze` on the singleton.** The default scope is shared across hot paths (every settings read, every workspace lookup); freezing prevents accidental mutation from leaking into a different request's tenant context.

## Migration plan

Three commits in this slice cover the contract roll-out:

1. **`chore(shared): introduce WorkspaceScope type and DEFAULT_LOCAL_SCOPE`** — type plus default singleton, re-exported from the storage barrel.
2. **`refactor(shared/config/storage): thread WorkspaceScope through 8 submodules`** — adds `_scope: WorkspaceScope = DEFAULT_LOCAL_SCOPE` (last position) to every public function across the eight submodules. 78 signatures widened across 8 files (`storage-internal.ts` is private and unchanged).
3. **`refactor(server-core): pass DEFAULT_LOCAL_SCOPE at bootstrap storage call sites`** — migrates the headless server bootstrap (`bootstrapConfigArtifacts`, `ensureGlobalConfigExists`) to pass the scope explicitly. The headless bootstrap is the canonical entry point for "single-user, single config dir" — explicit scoping there documents where a future multi-tenant bootstrap would route a different scope.

## Out of scope

- **Caller migration of the remaining ~50 storage call sites.** The defaulted parameter handles backward-compat indefinitely. Per-call-site migration is best-effort and adds churn without behavior change while no non-default scope ships. The largest remaining clusters: `packages/server-core/src/sessions/SessionManager.ts` (~12 calls), `packages/server-core/src/handlers/rpc/llm-connections.ts` (~8 calls), `packages/server-core/src/handlers/rpc/{settings,workspace}.ts` (~6 calls), `packages/server-core/src/model-fetchers/index.ts` (~4 calls), and the `apps/electron/src/main/handlers/*` cluster (~10 calls). They will migrate naturally when a non-default scope ships and the type checker forces the issue, or in a follow-up housekeeping pass.
- **Real multi-tenant authentication and isolation.** This ADR widens the *contract*, not the *implementation*. A future `kind: 'workspace'` branch needs:
  - workspace-id forgery defense (the scope must be derived from authenticated session state, not from request input)
  - per-tenant config-dir resolution in `storage-internal.ts` (today everything routes through `getConfigDir()` from `paths.ts`)
  - tenant-scoped credential namespaces in `credentials/manager.ts`
  - audit logging of cross-scope access attempts
  None of this is implemented; the type just reserves the slot.
- **Removing the default parameter.** Once a non-default scope ships and 100% of call sites are migrated, the `= DEFAULT_LOCAL_SCOPE` default should be deleted so the type checker forces every new call site to think about scope. Until then, the default is the contract.

## Security implications (when the union widens)

The `kind: 'workspace'` branch is reserved, not implemented. When it lands the implementer MUST treat the following as load-bearing:

- **Workspace-id forgery.** The scope must be derived from authenticated session state on the trusted side of the IPC boundary, never accepted from a renderer-supplied or webui-supplied request body. Treat scope like an authorization context, not a content key.
- **Scope leakage across requests.** The default `DEFAULT_LOCAL_SCOPE` is a frozen singleton — safe to share. A real per-request scope must be constructed fresh per request and must not be cached on shared state (e.g., module-level singletons, long-lived agent instances). The session lifecycle in `SessionManager` is the natural carrier.
- **Storage-root mixing.** Today every storage path derives from `getConfigDir()`. A tenant-scoped implementation must route the storage root through `storage-internal.ts` so a single typo in one submodule cannot cross-write into another tenant's data.

These are not concerns today. They are documented now so the implementer of the `kind: 'workspace'` arm sees them before the first commit.
