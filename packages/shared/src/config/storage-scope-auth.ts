import type { WorkspaceScope } from './storage-scope.ts';
import { isMultiTenantActivated } from './storage-scope-runtime.ts';
import { createLogger } from '../utils/debug.ts';

const log = createLogger('storage-scope');

const STORAGE_SCOPE_BRAND: unique symbol = Symbol('storage.scope.brand');

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

  return Object.freeze(scope) as T & BrandedWorkspaceScope;
}

function emitScopeAudit(
  level: 'trace' | 'warn' | 'error',
  event: string,
  payload: Record<string, unknown>,
): void {
  const message = JSON.stringify({ level, event, ...payload });
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
  if (!permittedWorkspaces.includes(requestedWorkspaceId)) {
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
