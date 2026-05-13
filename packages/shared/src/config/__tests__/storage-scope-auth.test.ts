import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';

import { enableDebug } from '../../utils/debug.ts';
import {
  __resetMultiTenantForTests,
  __setMultiTenantForTests,
} from '../storage-scope-runtime.ts';
import type { WorkspaceScope } from '../storage-scope.ts';
import {
  DEFAULT_LOCAL_SCOPE,
  deriveScopeFromAuth,
  MultiTenantForgeryError,
  type BrandedWorkspaceScope,
} from '../storage-scope-auth.ts';

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

describe('BrandedWorkspaceScope', () => {
  test('is structurally a WorkspaceScope', () => {
    const check: (scope: BrandedWorkspaceScope) => WorkspaceScope = (scope) => scope;
    expect(typeof check).toBe('function');
  });

  test('plain WorkspaceScope literal is not a BrandedWorkspaceScope at the type level', () => {
    // @ts-expect-error - unbranded literal is not assignable to the branded type.
    const bad: BrandedWorkspaceScope = { kind: 'local-single-user' };
    expect(bad.kind).toBe('local-single-user');
  });

  test('does not export the private brand symbol or brand applier', async () => {
    const module = await import('../storage-scope-auth.ts');
    expect('brand' in module).toBe(false);
    expect('BRAND' in module).toBe(false);
    expect('STORAGE_SCOPE_BRAND' in module).toBe(false);
  });
});

describe('DEFAULT_LOCAL_SCOPE', () => {
  test('is frozen', () => {
    expect(Object.isFrozen(DEFAULT_LOCAL_SCOPE)).toBe(true);
  });

  test('has kind === "local-single-user"', () => {
    expect(DEFAULT_LOCAL_SCOPE.kind).toBe('local-single-user');
  });

  test('satisfies BrandedWorkspaceScope at the type level', () => {
    const branded: BrandedWorkspaceScope = DEFAULT_LOCAL_SCOPE;
    expect(branded.kind).toBe('local-single-user');
  });
});

describe('deriveScopeFromAuth', () => {
  beforeEach(() => {
    __resetMultiTenantForTests();
  });

  afterEach(() => {
    __resetMultiTenantForTests();
  });

  test('single-user runtime returns DEFAULT_LOCAL_SCOPE without requested workspace', () => {
    __setMultiTenantForTests(false);

    const scope = deriveScopeFromAuth({ userId: 'u1', permittedWorkspaces: [] }, null);

    expect(scope).toBe(DEFAULT_LOCAL_SCOPE);
  });

  test('single-user runtime downgrades requested workspace to DEFAULT_LOCAL_SCOPE and emits audit', () => {
    __setMultiTenantForTests(false);
    enableDebug();
    const stderr = captureStderrWrites();

    try {
      const scope = deriveScopeFromAuth({ userId: 'u1', permittedWorkspaces: [] }, 'W42');

      expect(scope).toBe(DEFAULT_LOCAL_SCOPE);
      expect(stderr.writes.join('')).toContain('scope.factory.downgraded');
      expect(stderr.writes.join('')).toContain('multi-tenant-not-activated');
    } finally {
      stderr.restore();
    }
  });

  test('single-user runtime returns DEFAULT_LOCAL_SCOPE when requestedWorkspaceId is empty', () => {
    __setMultiTenantForTests(false);

    const scope = deriveScopeFromAuth({ userId: 'u1', permittedWorkspaces: [] }, '');

    expect(scope).toBe(DEFAULT_LOCAL_SCOPE);
  });

  test('multi-tenant runtime returns branded workspace scope when permitted', () => {
    __setMultiTenantForTests(true);

    const scope = deriveScopeFromAuth(
      { userId: 'u1', permittedWorkspaces: ['W42', 'W17'] },
      'W42',
    );

    expect(scope.kind).toBe('workspace');
    if (scope.kind !== 'workspace') {
      throw new Error('expected workspace scope');
    }
    expect(scope.workspaceId).toBe('W42');
  });

  test('multi-tenant runtime returns DEFAULT_LOCAL_SCOPE when requested workspace is null', () => {
    __setMultiTenantForTests(true);

    const scope = deriveScopeFromAuth({ userId: 'u1', permittedWorkspaces: ['W42'] }, null);

    expect(scope).toBe(DEFAULT_LOCAL_SCOPE);
  });

  test('multi-tenant runtime rejects unpermitted requested workspace and emits audit', () => {
    __setMultiTenantForTests(true);
    enableDebug();
    const stderr = captureStderrWrites();

    try {
      expect(() => {
        deriveScopeFromAuth({ userId: 'u1', permittedWorkspaces: ['W42'] }, 'W_OTHER');
      }).toThrow(MultiTenantForgeryError);

      expect(stderr.writes.join('')).toContain('scope.factory.forgery_rejected');
      expect(stderr.writes.join('')).toContain('W_OTHER');
    } finally {
      stderr.restore();
    }
  });

  test('MultiTenantForgeryError carries request context', () => {
    __setMultiTenantForTests(true);
    const stderr = captureStderrWrites();

    try {
      deriveScopeFromAuth({ userId: 'u1', permittedWorkspaces: ['W42'] }, 'W_OTHER');
      throw new Error('expected MultiTenantForgeryError');
    } catch (error) {
      expect(error).toBeInstanceOf(MultiTenantForgeryError);
      expect((error as MultiTenantForgeryError).userId).toBe('u1');
      expect((error as MultiTenantForgeryError).requestedWorkspaceId).toBe('W_OTHER');
      expect((error as MultiTenantForgeryError).permittedCount).toBe(1);
    } finally {
      stderr.restore();
    }
  });
});
