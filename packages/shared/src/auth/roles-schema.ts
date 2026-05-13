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

/**
 * Reserved `scopeId` literal that mirrors the global-owner sentinel
 * (`PERMITTED_WORKSPACES_GLOBAL_SENTINEL` in `./policy-engine.ts`).
 *
 * The literal `'*'` is observationally indistinguishable from the
 * global-owner sentinel inside `permittedWorkspaces` output. T243
 * Finding A documented the ambiguity. T244 closes the hole at the
 * schema layer: any persisted grant whose `scopeId` equals `'*'`
 * could impersonate a global-owner read in downstream consumers that
 * compare on sentinel-equality. Validators reject the value.
 */
export const RESERVED_WORKSPACE_SENTINEL_ID = '*';

/** Stable set of valid `ActorKind` values, used by the validator. */
export const VALID_ACTOR_KINDS: ReadonlyArray<ActorKind> = Object.freeze([
  'user',
  'team',
]);

/** Stable set of valid `ScopeKind` values, used by the validator. */
export const VALID_SCOPE_KINDS: ReadonlyArray<ScopeKind> = Object.freeze([
  'workspace',
  'org',
  'global',
]);

/**
 * Discriminated tag for `RoleGrant` validation failures. Each tag pins
 * a single reject reason so callers can branch (test, log, surface)
 * without parsing free-form messages.
 *
 * - `'reserved-scope-id'`     — `scopeId === '*'` for workspace/org.
 * - `'empty-scope-id'`        — `scopeId === ''` (always invalid).
 * - `'global-scope-with-id'`  — `scopeKind === 'global'` with non-null `scopeId`.
 * - `'scoped-without-id'`     — workspace/org with `null` `scopeId`.
 * - `'unknown-scope-kind'`    — `scopeKind` not in {workspace, org, global}.
 * - `'unknown-actor-kind'`    — `actorKind` not in {user, team}.
 * - `'empty-role-id'`         — `roleId === ''`.
 * - `'empty-actor-id'`        — `actorId === ''`.
 * - `'non-string-scope-id'`   — `scopeId` is neither a string nor `null`.
 */
export type RoleGrantValidationCode =
  | 'reserved-scope-id'
  | 'empty-scope-id'
  | 'global-scope-with-id'
  | 'scoped-without-id'
  | 'unknown-scope-kind'
  | 'unknown-actor-kind'
  | 'empty-role-id'
  | 'empty-actor-id'
  | 'non-string-scope-id';

/**
 * Validation failure detail. `code` is a stable machine tag, `message`
 * is a short human-friendly summary suitable for logs and test
 * assertions. Validators NEVER include the grant payload verbatim in
 * `message` to avoid leaking actor identifiers into structured logs.
 */
export interface RoleGrantValidationError {
  code: RoleGrantValidationCode;
  message: string;
}

/**
 * Discriminated `Result` union returned by `validateRoleGrant`. The
 * `ok` flag distinguishes success (`grant` is the validated grant)
 * from failure (`error` describes the reject reason).
 *
 * The validator does not mutate its input. On success the returned
 * `grant` is referentially equal to the input; on failure no `grant`
 * field is exposed (compile-time narrowing).
 */
export type RoleGrantValidationResult =
  | { ok: true; grant: RoleGrant }
  | { ok: false; error: RoleGrantValidationError };

function rejectGrant(
  code: RoleGrantValidationCode,
  message: string,
): RoleGrantValidationResult {
  return { ok: false, error: { code, message } };
}

/**
 * Validate a `RoleGrant` at the schema boundary. Returns a
 * discriminated `Result` union — pure, never throws, never mutates.
 *
 * Rejection rules (T244):
 *
 * 1. `scopeId === '*'` for any scoped kind (workspace/org) is rejected.
 *    The literal `'*'` is the reserved global-owner sentinel; a
 *    persisted grant with that id would smuggle a workspace-scoped
 *    entry into the global-sentinel output path of
 *    `permittedWorkspaces`. See T243 Finding A.
 * 2. `scopeId === ''` is rejected for workspace/org (empty ids are
 *    nonsense and were already filtered downstream by the policy
 *    engine; we assert at the boundary too).
 * 3. `scopeKind === 'global'` with non-null `scopeId` is rejected:
 *    global grants by contract have `scopeId === null`. Allowing a
 *    populated `scopeId` here would either be discarded silently
 *    (lossy) or cause confusion in downstream comparators.
 * 4. `scopeKind === 'workspace' | 'org'` with `scopeId === null` is
 *    rejected: scoped grants must name their scope.
 * 5. Unknown `scopeKind` values are rejected (defence in depth — TS
 *    union narrowing catches typed callers, the validator catches
 *    untyped persistence layers).
 * 6. Unknown `actorKind` values are rejected (same rationale as #5).
 * 7. Empty `roleId` and `actorId` are rejected.
 * 8. Non-string `scopeId` (other than `null`) is rejected — guards the
 *    JSON-deserialised path where a malformed payload could land.
 *
 * The validator deliberately does NOT check `roleId` against the
 * system role registry. Custom roles ride the same shape and are
 * resolved by the policy engine at evaluation time.
 */
export function validateRoleGrant(
  grant: RoleGrant,
): RoleGrantValidationResult {
  // Defensive guard against `null`/`undefined` payloads from untyped
  // persistence boundaries. The TS signature already rejects these,
  // but runtime callers (JSON deserialisation, RPC handlers) may
  // smuggle them through. We narrow by checking shape before
  // dereferencing fields.
  if (grant === null || typeof grant !== 'object') {
    return rejectGrant('unknown-scope-kind', 'grant must be an object');
  }

  const { roleId, actorKind, actorId, scopeKind, scopeId } = grant;

  if (typeof roleId !== 'string' || roleId.length === 0) {
    return rejectGrant('empty-role-id', 'roleId must be a non-empty string');
  }
  if (typeof actorId !== 'string' || actorId.length === 0) {
    return rejectGrant('empty-actor-id', 'actorId must be a non-empty string');
  }
  if (!VALID_ACTOR_KINDS.includes(actorKind as ActorKind)) {
    return rejectGrant(
      'unknown-actor-kind',
      `actorKind must be one of: ${VALID_ACTOR_KINDS.join(', ')}`,
    );
  }
  if (!VALID_SCOPE_KINDS.includes(scopeKind as ScopeKind)) {
    return rejectGrant(
      'unknown-scope-kind',
      `scopeKind must be one of: ${VALID_SCOPE_KINDS.join(', ')}`,
    );
  }

  if (scopeKind === 'global') {
    if (scopeId !== null) {
      return rejectGrant(
        'global-scope-with-id',
        'global-scope grants must have scopeId === null',
      );
    }
    return { ok: true, grant };
  }

  // scopeKind is 'workspace' | 'org' below.
  if (scopeId === null) {
    return rejectGrant(
      'scoped-without-id',
      `${scopeKind}-scope grants must have a non-null scopeId`,
    );
  }
  if (typeof scopeId !== 'string') {
    return rejectGrant(
      'non-string-scope-id',
      'scopeId must be a string or null',
    );
  }
  if (scopeId.length === 0) {
    return rejectGrant('empty-scope-id', 'scopeId must be non-empty');
  }
  if (scopeId === RESERVED_WORKSPACE_SENTINEL_ID) {
    return rejectGrant(
      'reserved-scope-id',
      `scopeId '${RESERVED_WORKSPACE_SENTINEL_ID}' is reserved as the global-owner sentinel and cannot be a literal ${scopeKind} id`,
    );
  }

  return { ok: true, grant };
}

/**
 * Throwing variant of `validateRoleGrant` for call sites that prefer
 * exceptions to discriminated unions. Returns the input grant verbatim
 * when valid; throws an `Error` whose `message` includes the
 * validation `code` when invalid.
 *
 * The thrown error carries a `code` property (typed via
 * `RoleGrantValidationCode`) so consumers can branch without parsing.
 */
export function assertValidRoleGrant(grant: RoleGrant): RoleGrant {
  const result = validateRoleGrant(grant);
  if (result.ok) return result.grant;
  const err = new Error(
    `invalid role grant [${result.error.code}]: ${result.error.message}`,
  ) as Error & { code: RoleGrantValidationCode };
  err.code = result.error.code;
  throw err;
}
