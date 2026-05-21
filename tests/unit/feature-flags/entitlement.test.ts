/**
 * Tests for the per-tenant Entitlement schema + resolve order.
 *
 * Covers AC-4, AC-5, AC-6 from spec §5 and items 2/3 from §6.
 */

import { afterEach, describe, expect, it } from 'bun:test';
import {
  EntitlementSchema,
  resolveEntitlement,
  type Entitlement,
} from '../../../packages/shared/src/feature-flags/entitlement.ts';
import {
  registerFlag,
  resetDynamicRegistry,
} from '../../../packages/shared/src/feature-flags/registry.ts';

const TENANT = '11111111-1111-4111-8111-111111111111';

function makeEntitlement(overrides: Partial<Entitlement>): Entitlement {
  return EntitlementSchema.parse({
    id: '00000000-0000-4000-8000-000000000001',
    tenantId: TENANT,
    featureKey: 'rox.feature.demo',
    value: true,
    source: 'tenant-override',
    expiresAt: null,
    createdAt: '2026-05-21T00:00:00',
    ...overrides,
  });
}

afterEach(() => {
  resetDynamicRegistry();
});

describe('Entitlement schema', () => {
  it('parses canonical entitlement rows', () => {
    const e = makeEntitlement({});
    expect(e.source).toBe('tenant-override');
    expect(e.value).toBe(true);
  });

  it('rejects unknown sources', () => {
    expect(() =>
      EntitlementSchema.parse({
        id: '00000000-0000-4000-8000-000000000001',
        tenantId: TENANT,
        featureKey: 'rox.feature.demo',
        value: true,
        source: 'made-up' as unknown as 'default',
        expiresAt: null,
        createdAt: '2026-05-21T00:00:00',
      }),
    ).toThrow();
  });

  it('accepts numeric and string entitlement values', () => {
    const numeric = makeEntitlement({ value: 5 });
    expect(numeric.value).toBe(5);
    const str = makeEntitlement({ value: 'eu' });
    expect(str.value).toBe('eu');
  });
});

describe('resolveEntitlement — priority order', () => {
  it('AC-4: tenant-override beats default', () => {
    registerFlag('rox.feature.priority-default', false, 'WT-99');
    const resolved = resolveEntitlement({
      tenantId: TENANT,
      featureKey: 'rox.feature.priority-default',
      entitlements: [
        makeEntitlement({
          featureKey: 'rox.feature.priority-default',
          value: true,
          source: 'tenant-override',
        }),
      ],
      now: new Date('2026-05-21T00:00:00Z'),
    });
    expect(resolved.value).toBe(true);
    expect(resolved.source).toBe('tenant-override');
  });

  it('AC-5: admin-grant beats tenant-override', () => {
    registerFlag('rox.feature.priority-admin', false, 'WT-99');
    const resolved = resolveEntitlement({
      tenantId: TENANT,
      featureKey: 'rox.feature.priority-admin',
      entitlements: [
        makeEntitlement({
          featureKey: 'rox.feature.priority-admin',
          value: false,
          source: 'tenant-override',
        }),
        makeEntitlement({
          featureKey: 'rox.feature.priority-admin',
          value: true,
          source: 'admin-grant',
        }),
      ],
      now: new Date('2026-05-21T00:00:00Z'),
    });
    expect(resolved.value).toBe(true);
    expect(resolved.source).toBe('admin-grant');
  });

  it('plan-pack beats default but loses to tenant-override', () => {
    registerFlag('rox.feature.priority-plan', false, 'WT-99');
    const resolved = resolveEntitlement({
      tenantId: TENANT,
      featureKey: 'rox.feature.priority-plan',
      entitlements: [
        makeEntitlement({
          featureKey: 'rox.feature.priority-plan',
          value: 'plan',
          source: 'plan-pack',
        }),
        makeEntitlement({
          featureKey: 'rox.feature.priority-plan',
          value: 'tenant',
          source: 'tenant-override',
        }),
      ],
      now: new Date('2026-05-21T00:00:00Z'),
    });
    expect(resolved.value).toBe('tenant');
    expect(resolved.source).toBe('tenant-override');
  });

  it('AC-6: expired entitlement is ignored, fallback to next-level', () => {
    registerFlag('rox.feature.expired', false, 'WT-99');
    const resolved = resolveEntitlement({
      tenantId: TENANT,
      featureKey: 'rox.feature.expired',
      entitlements: [
        makeEntitlement({
          featureKey: 'rox.feature.expired',
          value: true,
          source: 'admin-grant',
          expiresAt: '2026-05-20T00:00:00',
        }),
        makeEntitlement({
          featureKey: 'rox.feature.expired',
          value: 'plan-value',
          source: 'plan-pack',
        }),
      ],
      now: new Date('2026-05-21T00:00:00Z'),
    });
    expect(resolved.value).toBe('plan-value');
    expect(resolved.source).toBe('plan-pack');
  });

  it('future expiresAt is honored', () => {
    registerFlag('rox.feature.future', false, 'WT-99');
    const resolved = resolveEntitlement({
      tenantId: TENANT,
      featureKey: 'rox.feature.future',
      entitlements: [
        makeEntitlement({
          featureKey: 'rox.feature.future',
          value: true,
          source: 'admin-grant',
          expiresAt: '2026-06-01T00:00:00',
        }),
      ],
      now: new Date('2026-05-21T00:00:00Z'),
    });
    expect(resolved.value).toBe(true);
    expect(resolved.source).toBe('admin-grant');
  });

  it('falls back to compile-time default when no entitlement applies', () => {
    registerFlag('rox.feature.no-entitlement', false, 'WT-99');
    const resolved = resolveEntitlement({
      tenantId: TENANT,
      featureKey: 'rox.feature.no-entitlement',
      entitlements: [],
      now: new Date('2026-05-21T00:00:00Z'),
    });
    expect(resolved.value).toBe(false);
    expect(resolved.source).toBe('default');
  });

  it('ignores entitlements for other tenants', () => {
    registerFlag('rox.feature.other-tenant', false, 'WT-99');
    const resolved = resolveEntitlement({
      tenantId: TENANT,
      featureKey: 'rox.feature.other-tenant',
      entitlements: [
        makeEntitlement({
          featureKey: 'rox.feature.other-tenant',
          value: true,
          source: 'admin-grant',
          tenantId: '99999999-9999-4999-8999-999999999991',
        }),
      ],
      now: new Date('2026-05-21T00:00:00Z'),
    });
    expect(resolved.value).toBe(false);
    expect(resolved.source).toBe('default');
  });
});
