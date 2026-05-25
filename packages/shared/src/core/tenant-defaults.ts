/**
 * Default-tenant constants + resolver (WT-05, ADR A05-06).
 *
 * Behaviour:
 *   - Single-tenant mode (`ROX_MULTI_TENANT` unset or !== '1'): all code
 *     paths resolve to `DEFAULT_TENANT_ID`. This keeps the single-user
 *     install untouched while the multi-tenant contract lands.
 *   - Multi-tenant mode (`ROX_MULTI_TENANT === '1'`): callers MUST supply
 *     a `tenantId` in the resolver context; otherwise a
 *     `MissingTenantContextError` is thrown so the boundary fails closed.
 *
 * The constant UUID is intentionally fixed and B-tree-friendly (UUID v7
 * prefix `01890000-0000-7000-8000-…`). It is stable across restarts —
 * downstream features (audit, storage scoping, isolation tests) hash on
 * this value.
 */

import type { TenantId } from './tenant.ts';

/**
 * Stable UUID v7 for the default (single-tenant) install.
 * Version nibble at position 14 == '7'; variant nibble at position 19 == '8'.
 */
export const DEFAULT_TENANT_ID = '01890000-0000-7000-8000-000000000000' as TenantId;

/** Human-facing slug for the default tenant. */
export const DEFAULT_TENANT_SLUG = 'local' as const;

/** Env var that flips ROX.ONE into multi-tenant mode. */
export const MULTI_TENANT_ENV = 'ROX_MULTI_TENANT';

/** Returns true iff `id` is the canonical default tenant. */
export function isDefaultTenant(id: string): boolean {
  return id === DEFAULT_TENANT_ID;
}

/** Minimal context shape consumed by the resolver. */
export interface TenantResolverContext {
  /**
   * Caller-supplied tenant id (typically pulled from a JWT claim or
   * SCIM-issued session). Optional — absent when the caller is local.
   */
  tenantId?: string | null;
}

/**
 * Thrown in multi-tenant mode when no tenant context can be derived.
 * Surfacing this at the boundary prevents accidental cross-tenant reads.
 */
export class MissingTenantContextError extends Error {
  constructor(message = 'tenant context required when ROX_MULTI_TENANT=1') {
    super(message);
    this.name = 'MissingTenantContextError';
  }
}

function isMultiTenantEnabled(): boolean {
  return process.env[MULTI_TENANT_ENV] === '1';
}

/**
 * Resolve the effective tenant for a request.
 *
 *   - Single-tenant mode → always `DEFAULT_TENANT_ID`, regardless of ctx.
 *   - Multi-tenant mode → `ctx.tenantId` if present, else throws.
 *
 * The resolver is intentionally synchronous and pure-aside-from-env so it
 * can be called from any boundary (IPC handlers, scheduler, audit emit).
 */
export function resolveTenantId(ctx: TenantResolverContext): string {
  if (!isMultiTenantEnabled()) {
    return DEFAULT_TENANT_ID;
  }
  if (ctx.tenantId && ctx.tenantId.length > 0) {
    return ctx.tenantId;
  }
  throw new MissingTenantContextError();
}
