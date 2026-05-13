/**
 * RBAC role store — the persistence indirection for custom roles (T227).
 *
 * `RoleStore` is the read+create interface for the RBAC role catalog.
 * `SYSTEM_ROLES` (from `./roles-schema`) are always present in `list()`
 * output; custom roles are the operator-defined entries that the admin
 * RPC (`roles.create`) appends to the catalog.
 *
 * The interface is intentionally storage-agnostic: no database, no I/O,
 * no persistence adapters. `InMemoryRoleStore` is the default fake for
 * tests and for single-user runtimes that do not yet ship persisted
 * grant storage. Real persistence (database-backed) defers to future
 * Lane M phases.
 *
 * Hosts that want to expose admin RPC handlers wire a `RoleStore`
 * instance into `HandlerDeps.roleStore`. When the field is absent the
 * mutating handlers respond with `{error: 'rbac-not-configured'}` while
 * `roles.list` continues to return `SYSTEM_ROLES` from a fresh
 * `InMemoryRoleStore`. The catalog is always readable.
 */

import { type Role, SYSTEM_ROLES } from './roles-schema.ts';

/**
 * Async source of role definitions. Implementations must surface
 * `SYSTEM_ROLES` from `list()` and reject custom-role ids that collide
 * with the system role registry.
 */
export interface RoleStore {
  /** Return all known roles — `SYSTEM_ROLES` plus any custom roles. */
  list(): Promise<ReadonlyArray<Role>>;
  /**
   * Append a custom role. Throws when:
   *
   * - `role.id` is empty.
   * - `role.id` collides with a system role id.
   */
  create(role: Role): Promise<void>;
}

/**
 * In-memory `RoleStore`. Keeps custom roles in a `Map<string, Role>`
 * indexed by `id`. System role ids are never overridden.
 */
export class InMemoryRoleStore implements RoleStore {
  private readonly customRoles: Map<string, Role> = new Map();

  async list(): Promise<ReadonlyArray<Role>> {
    return [...SYSTEM_ROLES, ...this.customRoles.values()];
  }

  async create(role: Role): Promise<void> {
    if (!role.id || role.id.length === 0) {
      throw new Error('Role id must be non-empty');
    }
    if (SYSTEM_ROLES.some((r) => r.id === role.id)) {
      throw new Error(`Cannot override system role: ${role.id}`);
    }
    if (this.customRoles.has(role.id)) {
      throw new Error(`Role already exists: ${role.id}`);
    }
    this.customRoles.set(role.id, role);
  }
}
