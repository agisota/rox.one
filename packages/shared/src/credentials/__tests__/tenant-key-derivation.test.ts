import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';

import { DEFAULT_LOCAL_SCOPE, deriveScopeFromAuth, type BrandedWorkspaceScope } from '../../config/storage-scope.ts';
import {
  __resetMultiTenantForTests,
  __setMultiTenantForTests,
} from '../../config/storage-scope-runtime.ts';
import { enableDebug } from '../../utils/debug.ts';
import { SecureStorageBackend } from '../backends/secure-storage.ts';
import { CredentialManager } from '../manager.ts';

function captureStderrWrites() {
  const writes: string[] = [];
  const spy = spyOn(process.stderr, 'write').mockImplementation((chunk: string | Uint8Array) => {
    writes.push(String(chunk));
    return true;
  });

  return {
    writes,
    restore: () => spy.mockRestore(),
  };
}

function tenantScope(workspaceId: string): BrandedWorkspaceScope {
  __setMultiTenantForTests(true);
  return deriveScopeFromAuth(
    { userId: 'u1', permittedWorkspaces: [workspaceId], reqId: `req-${workspaceId}` },
    workspaceId,
  );
}

describe('tenant credential key derivation', () => {
  const previousConfigDir = process.env.ROX_CONFIG_DIR;
  let tempConfigDir: string | null = null;

  beforeEach(() => {
    __resetMultiTenantForTests();
    tempConfigDir = mkdtempSync(join(tmpdir(), 'rox-credentials-tenant-'));
    process.env.ROX_CONFIG_DIR = tempConfigDir;
  });

  afterEach(() => {
    __resetMultiTenantForTests();
    if (previousConfigDir === undefined) delete process.env.ROX_CONFIG_DIR;
    else process.env.ROX_CONFIG_DIR = previousConfigDir;
    if (tempConfigDir) {
      rmSync(tempConfigDir, { recursive: true, force: true });
      tempConfigDir = null;
    }
  });

  it('keeps DEFAULT_LOCAL_SCOPE credentials in the existing flat file', async () => {
    const manager = new CredentialManager(DEFAULT_LOCAL_SCOPE);

    await manager.setApiKey('flat-secret');

    expect(await manager.getApiKey()).toBe('flat-secret');
    expect(existsSync(join(tempConfigDir!, 'credentials.enc'))).toBe(true);
    expect(existsSync(join(tempConfigDir!, 'tenants'))).toBe(false);
  });

  it('reloads DEFAULT_LOCAL_SCOPE credentials from the existing flat file', async () => {
    const writer = new CredentialManager(DEFAULT_LOCAL_SCOPE);
    await writer.setApiKey('flat-secret');

    const reader = new CredentialManager(DEFAULT_LOCAL_SCOPE);

    expect(await reader.getApiKey()).toBe('flat-secret');
    expect(existsSync(join(tempConfigDir!, 'credentials.enc'))).toBe(true);
  });

  it('reads legacy flat credentials as fallback but writes new tenant credentials separately', async () => {
    const localManager = new CredentialManager(DEFAULT_LOCAL_SCOPE);
    await localManager.setApiKey('legacy-flat-secret');

    const scopedManager = new CredentialManager(tenantScope('tenant-a'));
    expect(await scopedManager.getApiKey()).toBe('legacy-flat-secret');

    await scopedManager.setApiKey('tenant-secret');

    expect(await scopedManager.getApiKey()).toBe('tenant-secret');
    expect(await localManager.getApiKey()).toBe('legacy-flat-secret');
    expect(existsSync(join(tempConfigDir!, 'credentials.enc'))).toBe(true);
    expect(existsSync(join(tempConfigDir!, 'tenants', 'tenant-a', 'credentials.enc'))).toBe(true);
  });

  it('stores tenant credentials with a KDF versioned envelope', async () => {
    const backend = new SecureStorageBackend(tenantScope('tenant-a'));

    await backend.set({ type: 'anthropic_api_key' }, { value: 'tenant-a-secret' });

    const store = await (
      backend as unknown as {
        loadStore(): Promise<{
          version: number;
          metadata: { kdfVersion?: number; workspaceId?: string };
        } | null>;
      }
    ).loadStore();

    expect(store?.version).toBe(2);
    expect(store?.metadata.kdfVersion).toBe(1);
    expect(store?.metadata.workspaceId).toBe('tenant-a');
  });

  it('does not decrypt another tenant credential file copied onto its path', async () => {
    const backendA = new SecureStorageBackend(tenantScope('tenant-a'));
    await backendA.set({ type: 'anthropic_api_key' }, { value: 'tenant-a-secret' });

    const tenantAFile = join(tempConfigDir!, 'tenants', 'tenant-a', 'credentials.enc');
    const tenantBFile = join(tempConfigDir!, 'tenants', 'tenant-b', 'credentials.enc');
    mkdirSync(dirname(tenantBFile), { recursive: true });
    copyFileSync(tenantAFile, tenantBFile);

    const backendB = new SecureStorageBackend(tenantScope('tenant-b'));

    expect(await backendB.get({ type: 'anthropic_api_key' })).toBeNull();
    expect((await backendA.get({ type: 'anthropic_api_key' }))?.value).toBe('tenant-a-secret');
  });

  it('emits trace audit events for tenant credential reads and writes', async () => {
    enableDebug();
    const stderr = captureStderrWrites();

    try {
      const manager = new CredentialManager(tenantScope('tenant-a'));

      await manager.setApiKey('tenant-secret');
      await manager.getApiKey();

      const output = stderr.writes.join('');
      expect(output).toContain('credential.scope.write');
      expect(output).toContain('credential.scope.read');
      expect(output).toContain('tenant-a');
    } finally {
      stderr.restore();
    }
  });
});
