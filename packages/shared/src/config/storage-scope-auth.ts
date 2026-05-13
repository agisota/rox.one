import type { WorkspaceScope } from './storage-scope.ts';
import { isMultiTenantActivated } from './storage-scope-runtime.ts';
import { appendStructuredAuditEvent } from '../audit/index.ts';
import { PERMITTED_WORKSPACES_GLOBAL_SENTINEL } from '../auth/policy-engine.ts';
import { createLogger } from '../utils/debug.ts';

const log = createLogger('storage-scope');

const STORAGE_SCOPE_BRAND: unique symbol = Symbol('storage.scope.brand');
const STORAGE_SCOPE_BRAND_REGISTRY = Symbol.for('rox.storage.scope.brandedScopes');
const brandedScopes = (() => {
  const root = globalThis as typeof globalThis & {
    [key: symbol]: WeakSet<object> | undefined;
  };
  let scopes = root[STORAGE_SCOPE_BRAND_REGISTRY];
  if (!scopes) {
    scopes = new WeakSet<object>();
    root[STORAGE_SCOPE_BRAND_REGISTRY] = scopes;
  }
  return scopes;
})();

export type BrandedWorkspaceScope = WorkspaceScope & {
  readonly [STORAGE_SCOPE_BRAND]: true;
};

export interface ScopeAuthContext {
  readonly userId?: string;
  readonly permittedWorkspaces?: readonly string[];
  readonly reqId?: string;
}

export class MultiTenantForgeryError extends Error {
  readonly userId: string;
  readonly requestedWorkspaceId: string;
  readonly permittedCount: number;
  readonly reqId?: string;

  constructor(
    userId: string,
    requestedWorkspaceId: string,
    permittedCount: number,
    reqId?: string,
  ) {
    super(
      `User ${userId} attempted to access workspace ${requestedWorkspaceId} ` +
        `but it is not in their permitted set (${permittedCount} permitted).`,
    );
    this.name = 'MultiTenantForgeryError';
    this.userId = userId;
    this.requestedWorkspaceId = requestedWorkspaceId;
    this.permittedCount = permittedCount;
    this.reqId = reqId;
  }
}

function brand<T extends WorkspaceScope>(scope: T): T & BrandedWorkspaceScope {
  Object.defineProperty(scope, STORAGE_SCOPE_BRAND, {
    value: true,
    enumerable: false,
    configurable: false,
    writable: false,
  });
  brandedScopes.add(scope);

  return Object.freeze(scope) as T & BrandedWorkspaceScope;
}

export function isBrandedWorkspaceScope(value: unknown): value is BrandedWorkspaceScope {
  return typeof value === 'object' && value !== null && brandedScopes.has(value);
}

function emitScopeAudit(
  level: 'trace' | 'warn' | 'error',
  event: string,
  payload: Record<string, unknown>,
): void {
  const message = JSON.stringify({ level, event, ...payload });
  appendStructuredAuditEvent(level, event, payload);
  if (level === 'trace') {
    log.debug(message);
    return;
  }
  if (level === 'warn') {
    log.warn(message);
    return;
  }
  log.error(message);
}

export const DEFAULT_LOCAL_SCOPE: BrandedWorkspaceScope = brand({
  kind: 'local-single-user',
});

export function deriveScopeFromAuth(
  session: ScopeAuthContext,
  requestedWorkspaceId: string | null | undefined,
): BrandedWorkspaceScope {
  const userId = session.userId ?? 'unknown';

  if (!isMultiTenantActivated()) {
    if (requestedWorkspaceId !== null && requestedWorkspaceId !== undefined && requestedWorkspaceId !== '') {
      emitScopeAudit('trace', 'scope.factory.downgraded', {
        userId,
        requestedWorkspaceId,
        reason: 'multi-tenant-not-activated',
        reqId: session.reqId,
      });
    }
    return DEFAULT_LOCAL_SCOPE;
  }

  if (requestedWorkspaceId === null || requestedWorkspaceId === undefined || requestedWorkspaceId === '') {
    return DEFAULT_LOCAL_SCOPE;
  }

  const permittedWorkspaces = session.permittedWorkspaces ?? [];
  // T226: the RBAC policy engine emits the `PERMITTED_WORKSPACES_GLOBAL_SENTINEL`
  // (`'*'`) when the actor holds a global-scope read grant. Treat that as
  // "any workspace permitted" rather than as a literal id to look up.
  const hasGlobalSentinel = permittedWorkspaces.includes(PERMITTED_WORKSPACES_GLOBAL_SENTINEL);
  if (!hasGlobalSentinel && !permittedWorkspaces.includes(requestedWorkspaceId)) {
    emitScopeAudit('warn', 'scope.factory.forgery_rejected', {
      userId,
      requestedWorkspaceId,
      permittedCount: permittedWorkspaces.length,
      reqId: session.reqId,
    });
    throw new MultiTenantForgeryError(
      userId,
      requestedWorkspaceId,
      permittedWorkspaces.length,
      session.reqId,
    );
  }

  return brand({
    kind: 'workspace',
    workspaceId: requestedWorkspaceId,
  });
}
