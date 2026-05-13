/**
 * Private shared helpers for the storage submodules.
 * NOT re-exported from the storage.ts barrel — these are file-internal helpers
 * that were previously private inside storage.ts and are kept private to preserve
 * the original public API after the split.
 *
 * Sibling files: storage-io.ts, storage-settings.ts, storage-workspaces.ts,
 * storage-conversations.ts, storage-drafts.ts, storage-themes.ts,
 * storage-llm-connections.ts, storage-tool-icons.ts.
 */
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { getConfigDir } from './paths.ts';
import {
  isBrandedWorkspaceScope,
  type BrandedWorkspaceScope,
} from './storage-scope-auth.ts';
import { isMultiTenantActivated } from './storage-scope-runtime.ts';
import { createLogger } from '../utils/debug.ts';

const log = createLogger('storage-scope');

export function getConfigFile(): string {
  return join(getConfigDir(), 'config.json');
}

export function getConfigDefaultsFile(): string {
  return join(getConfigDir(), 'config-defaults.json');
}

export function getWorkspacesDir(): string {
  return join(getConfigDir(), 'workspaces');
}

export function ensureWorkspaceDir(workspaceId: string): string {
  const dir = join(getWorkspacesDir(), workspaceId);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export class BrandedScopeBreachError extends Error {
  readonly receivedShape: unknown;

  constructor(receivedShape: unknown) {
    super('storage received an unbranded workspace scope');
    this.name = 'BrandedScopeBreachError';
    this.receivedShape = receivedShape;
  }
}

function emitScopeAudit(
  level: 'warn' | 'error',
  event: string,
  payload: Record<string, unknown>,
): void {
  const message = JSON.stringify({ level, event, ...payload });
  if (level === 'warn') {
    log.warn(message);
    return;
  }
  log.error(message);
}

function scopeShape(scope: unknown): unknown {
  if (scope === null || typeof scope !== 'object') {
    return scope;
  }
  const value = scope as Record<string, unknown>;
  return {
    kind: value.kind,
    workspaceId: value.workspaceId,
  };
}

export function getConfigDirForScope(scope: BrandedWorkspaceScope): string {
  if (!isBrandedWorkspaceScope(scope)) {
    emitScopeAudit('error', 'scope.brand.cast_breach', {
      scopeShape: scopeShape(scope),
    });
    throw new BrandedScopeBreachError(scopeShape(scope));
  }

  if (scope.kind === 'local-single-user') {
    return getConfigDir();
  }

  if (!isMultiTenantActivated()) {
    emitScopeAudit('warn', 'scope.runtime.workspace_downgraded', {
      workspaceId: scope.workspaceId,
    });
    return getConfigDir();
  }

  return join(getConfigDir(), 'tenants', scope.workspaceId);
}
