/**
 * Storage tenancy contract (Slice 3 / decomposition 2).
 *
 * Today every ROX install is single-user / local-disk. The storage submodules
 * (storage-io.ts, storage-settings.ts, storage-workspaces.ts,
 * storage-conversations.ts, storage-drafts.ts, storage-themes.ts,
 * storage-llm-connections.ts, storage-tool-icons.ts) all read/write a single
 * config dir derived from `getConfigDir()`. ADR 0002 reserved tenancy as
 * out-of-scope for the original split, and ADR 0005 closes that loop by
 * threading a `WorkspaceScope` parameter through every public storage API so
 * a future multi-tenant or workspace-isolated implementation has a single
 * widening-friendly choke point to swap behind.
 *
 * The discriminated-union shape mirrors the existing app-level vs
 * per-workspace split that already lives inside `StoredConfig`:
 * - `kind: 'local-single-user'` — current behavior; one config dir, one user,
 *   no workspace-id required at the storage layer (per-workspace functions
 *   still take `workspaceId` because that addresses *which* workspace inside
 *   the single tenant).
 * - `kind: 'workspace'` — a future tenant scope keyed by workspaceId at the
 *   *storage-root* level, so that one process can host multiple isolated
 *   stores. Reserved; no implementation today, but the type is wired so
 *   `scope: WorkspaceScope` is already a no-op at every call site.
 *
 * Backward-compat rule: every public storage function accepts `scope` as the
 * last parameter, defaulted to `DEFAULT_LOCAL_SCOPE`. Callers migrated in
 * follow-up commits pass the constant explicitly. Default-param keeps the
 * branch shippable at every commit.
 */

/**
 * Tenancy scope for a storage call.
 *
 * Discriminated union so a future `kind: 'workspace'` branch can carry
 * additional fields (workspaceId, root override, encryption envelope, ...)
 * without breaking the existing `'local-single-user'` callers.
 */
export type WorkspaceScope =
  | { readonly kind: 'local-single-user' }
  | { readonly kind: 'workspace'; readonly workspaceId: string };

/**
 * Singleton default scope for the current single-user / local-disk install.
 * Pass this at every storage call site so we have a complete migration even
 * before any non-default scope is implemented. When tenant scopes ship, only
 * the small number of multi-tenant-aware call sites need to change.
 */
export const DEFAULT_LOCAL_SCOPE: WorkspaceScope = Object.freeze({
  kind: 'local-single-user',
});

/**
 * Narrowing helper: derive the optional workspaceId addressed by a scope.
 *
 * Returns `undefined` for the local-single-user scope (which doesn't address
 * a workspace at the *storage-root* level). Per-workspace storage functions
 * still take `workspaceId: string` separately — that's the *content* address,
 * not the *tenant* address.
 */
export function workspaceIdFromScope(scope: WorkspaceScope): string | undefined {
  return scope.kind === 'workspace' ? scope.workspaceId : undefined;
}
