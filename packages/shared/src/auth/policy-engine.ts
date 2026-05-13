/**
 * RBAC policy engine — pure-function policy evaluator (T225).
 *
 * The evaluator answers "may this actor perform this action on this resource?"
 * by consulting role grants and the action set declared by each system role.
 * It is deliberately storage-agnostic and side-effect free:
 *
 * - no I/O (no fs, no network, no database)
 * - no `process.env` reads
 * - no mutation of inputs
 * - same inputs always produce the same output
 *
 * The engine consumes the role grant shape from `./roles-schema` and is
 * consumed by `deriveScopeFromAuth` (via `permittedWorkspaces`) and by future
 * RBAC admin RPC handlers (T227).
 */

import type { RoleGrant, RbacAction, ScopeKind } from './roles-schema';

/**
 * The verdict returned by `evaluate`. `allow` is the boolean access decision.
 * `reason` is a short machine-friendly tag suitable for logging and tests:
 *
 *   - `'no-grant'` — the actor has zero grants.
 *   - `'no-matching-scope'` — the actor has grants but none cover the
 *     requested action × resource.
 *   - `'global-<roleId>'` — a global-scope grant allowed the action.
 *   - `'<scopeKind>-<roleId>'` — a scoped grant allowed the action.
 */
export interface PolicyDecision {
  allow: boolean;
  reason: string;
}

/** The resource the policy is being evaluated against. */
export interface PolicyResource {
  scopeKind: ScopeKind;
  scopeId: string | null;
}

/**
 * Sentinel value emitted by `permittedWorkspaces` when a grant covers
 * every workspace (i.e. a global-scope read). The sentinel is the literal
 * string `'*'`. Callers that consume `permittedWorkspaces` MUST treat this
 * sentinel as "no workspace filter" rather than as a workspace id.
 */
export const PERMITTED_WORKSPACES_GLOBAL_SENTINEL = '*';

/**
 * Action set granted by each system role. The engine only allows access
 * when the grant's `roleId` is in this map AND the requested action is in
 * the action set.
 *
 * User-defined roles are not in this map yet; that path lands with T227
 * (admin RPC). For T225 the engine treats unknown role ids as "no actions".
 */
const ROLE_ACTIONS: Record<string, ReadonlySet<RbacAction>> = Object.freeze({
  owner: Object.freeze(new Set<RbacAction>(['read', 'write', 'admin'])),
  editor: Object.freeze(new Set<RbacAction>(['read', 'write'])),
  viewer: Object.freeze(new Set<RbacAction>(['read'])),
});

function grantCoversResource(grant: RoleGrant, resource: PolicyResource): boolean {
  if (grant.scopeKind === 'global') return true;
  if (grant.scopeKind !== resource.scopeKind) return false;
  return grant.scopeId === resource.scopeId;
}

function reasonFor(grant: RoleGrant): string {
  return grant.scopeKind === 'global'
    ? `global-${grant.roleId}`
    : `${grant.scopeKind}-${grant.roleId}`;
}

/**
 * Decide whether the action is permitted on the resource given the grants.
 * Pure function. Never throws.
 *
 * The first grant that satisfies both "role allows this action" and
 * "grant covers this resource" wins. The union of grants applies: a
 * single allowing grant is enough.
 */
export function evaluate(
  grants: ReadonlyArray<RoleGrant>,
  action: RbacAction,
  resource: PolicyResource,
): PolicyDecision {
  for (const grant of grants) {
    const actions = ROLE_ACTIONS[grant.roleId];
    if (!actions || !actions.has(action)) continue;
    if (!grantCoversResource(grant, resource)) continue;
    return { allow: true, reason: reasonFor(grant) };
  }
  return {
    allow: false,
    reason: grants.length === 0 ? 'no-grant' : 'no-matching-scope',
  };
}

/**
 * Return the set of workspace ids the actor is allowed to read.
 *
 * - When any grant is a global-scope read, the return value is a single
 *   entry equal to `PERMITTED_WORKSPACES_GLOBAL_SENTINEL` (`'*'`),
 *   signaling "all workspaces". Callers MUST handle this sentinel.
 * - Otherwise the return value is the deduplicated set of workspace ids
 *   covered by workspace-scope read grants.
 * - Org-scope grants are ignored here; they do not enumerate workspace ids.
 *
 * The result is frozen so callers cannot accidentally mutate it.
 */
export function permittedWorkspaces(
  grants: ReadonlyArray<RoleGrant>,
): ReadonlyArray<string> {
  const ids = new Set<string>();
  let global = false;
  for (const grant of grants) {
    const actions = ROLE_ACTIONS[grant.roleId];
    if (!actions || !actions.has('read')) continue;
    if (grant.scopeKind === 'global') {
      global = true;
      continue;
    }
    if (grant.scopeKind === 'workspace' && grant.scopeId !== null && grant.scopeId !== '') {
      ids.add(grant.scopeId);
    }
  }
  if (global) {
    return Object.freeze([PERMITTED_WORKSPACES_GLOBAL_SENTINEL]);
  }
  return Object.freeze(Array.from(ids));
}
