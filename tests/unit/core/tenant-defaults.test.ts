/**
 * WT-05 — Tenant defaults: DEFAULT_TENANT_ID, slug, resolver behaviour.
 *
 * TDD-first: this file is committed BEFORE the implementation lands.
 * Once `packages/shared/src/core/tenant-defaults.ts` and the supporting
 * schemas exist, every assertion below MUST pass.
 *
 * Cross-references:
 *   - Spec: docs/superpowers/specs/2026-05-21-wt-05-tenant-org-design.md §3, §5
 *   - AC: AC-5, AC-6, AC-7
 */

import { describe, expect, it, beforeEach, afterEach } from 'bun:test';

import {
  DEFAULT_TENANT_ID,
  DEFAULT_TENANT_SLUG,
  isDefaultTenant,
  resolveTenantId,
  MissingTenantContextError,
} from '../../../packages/shared/src/core/tenant-defaults.ts';

const ENV_KEY = 'ROX_MULTI_TENANT';

describe('tenant-defaults', () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env[ENV_KEY];
    delete process.env[ENV_KEY];
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env[ENV_KEY];
    } else {
      process.env[ENV_KEY] = originalEnv;
    }
  });

  describe('constants', () => {
    it('exposes a stable UUID v7 for DEFAULT_TENANT_ID', () => {
      expect(DEFAULT_TENANT_ID).toBe('01890000-0000-7000-8000-000000000000');
      // RFC 4122 / draft-7: version nibble at position 14 must be '7'.
      expect(DEFAULT_TENANT_ID[14]).toBe('7');
    });

    it('uses "local" as the human-facing slug', () => {
      expect(DEFAULT_TENANT_SLUG).toBe('local');
    });
  });

  describe('isDefaultTenant()', () => {
    it('returns true for DEFAULT_TENANT_ID', () => {
      expect(isDefaultTenant(DEFAULT_TENANT_ID)).toBe(true);
    });

    it('returns false for any other UUID', () => {
      expect(isDefaultTenant('11111111-1111-7111-8111-111111111111')).toBe(false);
      expect(isDefaultTenant('00000000-0000-0000-0000-000000000000')).toBe(false);
    });

    it('returns false for clearly invalid input', () => {
      expect(isDefaultTenant('')).toBe(false);
      expect(isDefaultTenant('not-a-uuid')).toBe(false);
    });
  });

  describe('resolveTenantId()', () => {
    it('returns DEFAULT_TENANT_ID when ROX_MULTI_TENANT is unset (AC-6)', () => {
      delete process.env[ENV_KEY];
      expect(resolveTenantId({})).toBe(DEFAULT_TENANT_ID);
    });

    it('returns DEFAULT_TENANT_ID when ROX_MULTI_TENANT !== "1"', () => {
      process.env[ENV_KEY] = '0';
      expect(resolveTenantId({})).toBe(DEFAULT_TENANT_ID);
      process.env[ENV_KEY] = 'true';
      expect(resolveTenantId({})).toBe(DEFAULT_TENANT_ID);
    });

    it('throws MissingTenantContextError when multi-tenant=1 and no auth context (AC-7)', () => {
      process.env[ENV_KEY] = '1';
      expect(() => resolveTenantId({})).toThrow(MissingTenantContextError);
    });

    it('returns the supplied tenantId when multi-tenant=1 and context carries one', () => {
      process.env[ENV_KEY] = '1';
      const provided = '22222222-2222-7222-8222-222222222222';
      expect(resolveTenantId({ tenantId: provided })).toBe(provided);
    });

    it('does not emit warn-level audit when falling back to default (smoke)', () => {
      // We can't easily snapshot the audit pipeline here; instead we assert
      // resolveTenantId is a pure function in the OFF path and does not throw
      // or hit a console hook.
      delete process.env[ENV_KEY];
      const before = console.warn;
      let warned = false;
      console.warn = () => {
        warned = true;
      };
      try {
        resolveTenantId({});
        expect(warned).toBe(false);
      } finally {
        console.warn = before;
      }
    });
  });
});
