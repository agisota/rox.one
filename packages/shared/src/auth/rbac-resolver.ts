/**
 * RBAC resolver — the indirection that produces `session.permittedWorkspaces`
 * for the multi-tenant `deriveScopeFromAuth` path (T226) and the
 * owner-grant lookup the admin RPC handlers rely on (T227).
 *
 * T225 landed `permittedWorkspaces(grants)` as a pure function over
 * `RoleGrant[]`. T226 plugged that function into the runtime: callers ask
 * the resolver for the permitted workspace ids of a user, the resolver
 * reads grants from a pluggable `GrantStore`, and the policy engine
 * answers. T227 extends the resolver with:
 *
 * - `ownerGrantsForUser(userId)` — returns the user's `owner`-roleId
 *   grants. The admin RPC handlers consult it before mutating roles or
 *   grants.
 * - `invalidateUser(userId)` — cache-bust hook called after a successful
 *   revoke. The current resolver has no cache so this is a no-op stub;
 *   future caching layers (e.g. the Postgres-backed store) MUST override
 *   it to evict stale grants.
 *
 * The `GrantStore` interface gained mutation methods (`grant`, `revoke`)
 * in T227. `InMemoryGrantStore` implements them as O(actorId-bucket)
 * operations.
 */

import { permittedWorkspaces } from './policy-engine.ts';
import { assertValidRoleGrant, type RoleGrant } from './roles-schema.ts';

/**
 * Async source of `RoleGrant` entries for a given user.
 *
 * Implementations must be read-consistent from the caller's perspective.
 * They may be backed by an in-memory map (today), a database (T227+),
 * or any other persistence layer.
 *
 * `grantsForUser` returns the grants whose `actorKind === 'user'` and
 * whose `actorId` matches the requested user id. Team-actor grants are
 * out of scope for T226 and SHOULD be filtered by the store before they
 * reach the resolver.
 *
 * `grant` / `revoke` are the mutation methods introduced in T227. The
 * admin RPC handlers call through these. `revoke` returns `true` if a
 * grant was removed and `false` if nothing matched (idempotent).
 *
 * Implementations MUST validate inputs at the mutation boundary via
 * `validateRoleGrant` (T244). The reserved-scope-id `'*'` and other
 * malformed grant shapes are rejected before persistence so the
 * runtime cannot serve a smuggled grant from a cached / persisted
 * store. The `InMemoryGrantStore` shipped here uses
 * `assertValidRoleGrant` for both seeding and `grant()` calls.
 */
export interface GrantStore {
  grantsForUser(userId: string): Promise<ReadonlyArray<RoleGrant>>;
  /**
   * Add a grant. Implementations MAY ignore non-user actor kinds when
   * team RBAC is not yet wired. `InMemoryGrantStore` ignores team grants.
   * Implementations MUST validate the grant via `validateRoleGrant`
   * before persistence (T244).
   */
  grant(grant: RoleGrant): Promise<void>;
  /**
   * Remove a grant matching all five fields (`roleId`, `actorKind`,
   * `actorId`, `scopeKind`, `scopeId`). Returns `true` if a grant was
   * removed, `false` if nothing matched.
   */
  revoke(grant: RoleGrant): Promise<boolean>;
}

function grantsEqual(a: RoleGrant, b: RoleGrant): boolean {
  return (
    a.roleId === b.roleId &&
    a.actorKind === b.actorKind &&
    a.actorId === b.actorId &&
    a.scopeKind === b.scopeKind &&
    a.scopeId === b.scopeId
  );
}

/**
 * In-memory `GrantStore` seeded at construction time. Suitable for tests
 * and for single-user runtimes that have no persisted grants yet. Indexes
 * grants by `actorId` so per-user lookups are O(1). Skips any seeded
 * grant whose `actorKind` is not `'user'` because T226 only ships
 * user-actor wiring; team RBAC lands in a later phase.
 *
 * T244 hardens the seed + mutation paths: every grant is fed through
 * `assertValidRoleGrant` before being persisted. A constructor seed
 * with an invalid grant throws synchronously; a runtime `grant()`
 * call with an invalid grant rejects the returned promise. The
 * reserved sentinel `'*'` cannot reach `grantsByUser`.
 */
export class InMemoryGrantStore implements GrantStore {
  private readonly grantsByUser: Map<string, RoleGrant[]> = new Map();

  constructor(initial: ReadonlyArray<RoleGrant> = []) {
    for (const grant of initial) {
      // Validate before any structural filtering. Throwing here
      // surfaces persistence-layer bugs at construction time instead
      // of at first read.
      assertValidRoleGrant(grant);
      if (grant.actorKind !== 'user') continue;
      const bucket = this.grantsByUser.get(grant.actorId) ?? [];
      bucket.push(grant);
      this.grantsByUser.set(grant.actorId, bucket);
    }
  }

  async grantsForUser(userId: string): Promise<ReadonlyArray<RoleGrant>> {
    return this.grantsByUser.get(userId) ?? [];
  }

  async grant(grant: RoleGrant): Promise<void> {
    assertValidRoleGrant(grant);
    if (grant.actorKind !== 'user') return;
    const bucket = this.grantsByUser.get(grant.actorId) ?? [];
    if (!bucket.some((existing) => grantsEqual(existing, grant))) {
      bucket.push(grant);
    }
    this.grantsByUser.set(grant.actorId, bucket);
  }

  async revoke(grant: RoleGrant): Promise<boolean> {
    // revoke() is intentionally NOT gated on `validateRoleGrant`:
    // operators MUST be able to clean up grants that pre-date the
    // T244 reservation (e.g. a smuggled grant persisted before this
    // ticket landed). The lookup matches on the five-field tuple, so
    // a forged grant simply won't match anything valid.
    if (grant.actorKind !== 'user') return false;
    const bucket = this.grantsByUser.get(grant.actorId);
    if (!bucket) return false;
    const idx = bucket.findIndex((existing) => grantsEqual(existing, grant));
    if (idx < 0) return false;
    bucket.splice(idx, 1);
    if (bucket.length === 0) {
      this.grantsByUser.delete(grant.actorId);
    }
    return true;
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
   * Return the permitted workspace ids for the given user. Delegates to
   * the pure-function `permittedWorkspaces` policy engine; the returned
   * array may include the global sentinel (`'*'`) when the user holds a
   * global read grant.
   */
  async permittedWorkspacesForUser(userId: string): Promise<ReadonlyArray<string>> {
    const grants = await this.grantStore.grantsForUser(userId);
    return permittedWorkspaces(grants);
  }

  /**
   * Return the user's `owner`-roleId grants (T227). The admin RPC
   * handlers consult this to check whether the caller may mutate a role
   * or grant on a target scope.
   */
  async ownerGrantsForUser(userId: string): Promise<ReadonlyArray<RoleGrant>> {
    const grants = await this.grantStore.grantsForUser(userId);
    return grants.filter((g) => g.roleId === 'owner');
  }

  /**
   * Cache-bust hook called after a successful revoke (T227). The current
   * resolver has no cache so this is a no-op stub. Future caching layers
   * MUST override this method to evict stale grants for `userId` from
   * any in-process / process-local cache, otherwise stale
   * `permittedWorkspaces` arrays will persist across the revoke
   * boundary.
   */
  invalidateUser(_userId: string): void {
    // No-op stub. Future caching layers override.
  }
}
