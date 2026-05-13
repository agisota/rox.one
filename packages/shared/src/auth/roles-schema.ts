/**
 * RBAC roles schema — types and the system-managed role registry.
 *
 * This module is the data-model foundation for the M.2 RBAC slice (T224).
 * It is intentionally storage-agnostic: no database, no I/O, no persistence
 * adapters live here. Persistence is layered on top in a later slice (T226+).
 *
 * The shapes here are also the contract surface for the policy engine
 * (`./policy-engine`, T225) and for downstream consumers that read or write
 * role grants.
 */

/**
 * A role definition. Roles are referenced by `id` from `RoleGrant.roleId`.
 *
 * - `id` is the stable identifier (e.g. `'owner'`, `'editor'`, `'viewer'`).
 * - `name` is the human-facing label.
 * - `description` is an optional human-facing summary.
 * - `systemManaged` is `true` for built-in roles that the platform
 *   provisions and that callers may not edit or delete.
 */
export interface Role {
  id: string;
  name: string;
  description?: string;
  systemManaged: boolean;
}

/** What kind of actor a grant applies to. */
export type ActorKind = 'user' | 'team';

/** What level of scope a grant covers. */
export type ScopeKind = 'workspace' | 'org' | 'global';

/** Coarse-grained action verbs evaluated by the policy engine. */
export type RbacAction = 'read' | 'write' | 'admin';

/**
 * A binding of a role to an actor (user or team) within a scope
 * (workspace, org, or global).
 *
 * `scopeId` is the concrete scope identifier when `scopeKind` is `'workspace'`
 * or `'org'`. For `'global'` grants, `scopeId` is `null` because the grant
 * applies to every scope.
 */
export interface RoleGrant {
  roleId: string;
  actorKind: ActorKind;
  actorId: string;
  scopeKind: ScopeKind;
  scopeId: string | null;
}

/**
 * Built-in system roles. The platform provisions exactly these three:
 *
 * - `owner`  — full control (`read`, `write`, `admin`).
 * - `editor` — content authoring (`read`, `write`).
 * - `viewer` — read-only access (`read`).
 *
 * The registry is frozen so callers cannot mutate it at runtime.
 */
export const SYSTEM_ROLES: ReadonlyArray<Role> = Object.freeze([
  Object.freeze({
    id: 'owner',
    name: 'Owner',
    description: 'Full control over the scope',
    systemManaged: true,
  }),
  Object.freeze({
    id: 'editor',
    name: 'Editor',
    description: 'Read and write access',
    systemManaged: true,
  }),
  Object.freeze({
    id: 'viewer',
    name: 'Viewer',
    description: 'Read-only access',
    systemManaged: true,
  }),
]);

/**
 * Returns `true` if the given role is one of the built-in system roles
 * (matched by `id`). User-defined roles return `false`.
 */
export function isSystemRole(role: Role): boolean {
  if (role.id === '') return false;
  return SYSTEM_ROLES.some((systemRole) => systemRole.id === role.id);
}
