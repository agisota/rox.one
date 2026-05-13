/**
 * RBAC resolver — the indirection that produces `session.permittedWorkspaces`
 * for the multi-tenant `deriveScopeFromAuth` path (T226).
 *
 * T225 landed `permittedWorkspaces(grants)` as a pure function over
 * `RoleGrant[]`. T226 plugs that function into the runtime: callers ask the
 * resolver for the permitted workspace ids of a user, the resolver reads
 * grants from a pluggable `GrantStore`, and the policy engine answers.
 *
 * Persisted grant storage and admin RPC for granting/revoking roles arrive in
 * T227. Until then the in-memory store ships as the default fake — single-user
 * runtimes get an empty store and behaviour stays bit-identical to the pre-
 * change `AccountStore.listWorkspaceIds` path, because the call sites only
 * consult the resolver when a host injects one into `HandlerDeps`.
 */

import { permittedWorkspaces } from './policy-engine.ts';
import type { RoleGrant } from './roles-schema.ts';

/**
 * Async source of `RoleGrant` entries for a given user.
 *
 * Implementations must be read-only from the caller's perspective. They may
 * be backed by an in-memory map (today), a database (T227+), or any other
 * persistence layer.
 *
 * `grantsForUser` returns the grants whose `actorKind === 'user'` and whose
 * `actorId` matches the requested user id. Team-actor grants are out of
 * scope for T226 and SHOULD be filtered by the store before they reach the
 * resolver.
 */
export interface GrantStore {
  grantsForUser(userId: string): Promise<ReadonlyArray<RoleGrant>>;
}

/**
 * In-memory `GrantStore` seeded at construction time. Suitable for tests and
 * for single-user runtimes that have no persisted grants yet. Indexes grants
 * by `actorId` so per-user lookups are O(1). Skips any seeded grant whose
 * `actorKind` is not `'user'` because T226 only ships user-actor wiring.
 */
export class InMemoryGrantStore implements GrantStore {
  private readonly grantsByUser: Map<string, RoleGrant[]> = new Map();

  constructor(initial: ReadonlyArray<RoleGrant> = []) {
    for (const grant of initial) {
      if (grant.actorKind !== 'user') continue;
      const bucket = this.grantsByUser.get(grant.actorId) ?? [];
      bucket.push(grant);
      this.grantsByUser.set(grant.actorId, bucket);
    }
  }

  async grantsForUser(userId: string): Promise<ReadonlyArray<RoleGrant>> {
    return this.grantsByUser.get(userId) ?? [];
  }
}

/**
 * Resolves the permitted workspace ids for a user by consulting a
 * `GrantStore` and delegating to the T225 policy engine.
 *
 * Hosts that have not yet adopted RBAC should NOT inject an `RbacResolver`
 * into `HandlerDeps`. The RPC scope helpers (`deriveWorkspaceScope`,
 * `deriveRpcWorkspaceScope`) fall back to `AccountStore.listWorkspaceIds`
 * when the resolver is absent, preserving the C.4 `deriveScopeFromAuth`
 * contract.
 */
export class RbacResolver {
  constructor(private readonly grantStore: GrantStore) {}

  /**
   * Return the permitted workspace ids for the given user. Delegates to the
   * pure-function `permittedWorkspaces` policy engine; the returned array
   * may include the global sentinel (`'*'`) when the user holds a global
   * read grant.
   */
  async permittedWorkspacesForUser(userId: string): Promise<ReadonlyArray<string>> {
    const grants = await this.grantStore.grantsForUser(userId);
    return permittedWorkspaces(grants);
  }
}
