import type {
  PiStorageScopeAuthEnvelope,
} from '../../shared/src/agent/backend/types.ts';
import {
  DEFAULT_LOCAL_SCOPE,
  deriveScopeFromAuth,
  type BrandedWorkspaceScope,
} from '../../shared/src/config/storage-scope-auth.ts';
import { getConfigDirForScope } from '../../shared/src/config/storage-internal.ts';

export const PI_SCOPE_IPC_TOKEN_ENV = 'ROX_PI_SCOPE_IPC_TOKEN';

export interface BootstrappedStorageScope {
  scope: BrandedWorkspaceScope;
  configDir: string;
  workspaceId?: string;
}

export class PiStorageScopeIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PiStorageScopeIntegrityError';
  }
}

export class PiStorageScopeEnvelopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PiStorageScopeEnvelopeError';
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function parseEnvelope(envelope: unknown): PiStorageScopeAuthEnvelope {
  if (!envelope || typeof envelope !== 'object') {
    throw new PiStorageScopeEnvelopeError('Pi storage-scope envelope must be an object');
  }

  const value = envelope as Record<string, unknown>;
  const requestedWorkspaceId = value.requestedWorkspaceId;
  if (requestedWorkspaceId !== null && !isNonEmptyString(requestedWorkspaceId)) {
    throw new PiStorageScopeEnvelopeError('requestedWorkspaceId must be null or a non-empty string');
  }

  if (!Array.isArray(value.permittedWorkspaces) || !value.permittedWorkspaces.every(isNonEmptyString)) {
    throw new PiStorageScopeEnvelopeError('permittedWorkspaces must be an array of non-empty strings');
  }

  if (value.userId !== undefined && !isNonEmptyString(value.userId)) {
    throw new PiStorageScopeEnvelopeError('userId must be a non-empty string when provided');
  }

  if (value.reqId !== undefined && !isNonEmptyString(value.reqId)) {
    throw new PiStorageScopeEnvelopeError('reqId must be a non-empty string when provided');
  }

  if (!isNonEmptyString(value.integrityToken)) {
    throw new PiStorageScopeIntegrityError('Pi storage-scope integrity token is missing');
  }

  return {
    requestedWorkspaceId,
    permittedWorkspaces: [...value.permittedWorkspaces],
    ...(value.userId ? { userId: value.userId } : {}),
    ...(value.reqId ? { reqId: value.reqId } : {}),
    integrityToken: value.integrityToken,
  };
}

function resolveBootstrappedScope(scope: BrandedWorkspaceScope): BootstrappedStorageScope {
  return {
    scope,
    configDir: getConfigDirForScope(scope),
    ...(scope.kind === 'workspace' ? { workspaceId: scope.workspaceId } : {}),
  };
}

export function bootstrapScope(
  envelope: unknown,
  env: NodeJS.ProcessEnv = process.env,
): BootstrappedStorageScope {
  if (envelope === undefined || envelope === null) {
    return resolveBootstrappedScope(DEFAULT_LOCAL_SCOPE);
  }

  const parsed = parseEnvelope(envelope);
  const expectedToken = env[PI_SCOPE_IPC_TOKEN_ENV];
  if (!isNonEmptyString(expectedToken) || parsed.integrityToken !== expectedToken) {
    throw new PiStorageScopeIntegrityError('Pi storage-scope integrity token mismatch');
  }

  const scope = deriveScopeFromAuth(
    {
      userId: parsed.userId,
      permittedWorkspaces: parsed.permittedWorkspaces,
      reqId: parsed.reqId,
    },
    parsed.requestedWorkspaceId,
  );

  return resolveBootstrappedScope(scope);
}
