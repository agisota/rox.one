/**
 * WT-05 — Tenant zod schema, branded id, soft-delete invariants.
 *
 * TDD-first per master Section 2.2. Acceptance criteria mapping:
 *   AC-1 (parse valid), AC-2 (slug lowercase), AC-3 (plan enum strict),
 *   AC-4 (deletedAt defaults to null), AC-9 (serialize round-trip).
 */

import { describe, expect, it } from 'bun:test';

import {
  Tenant,
  TenantPlan,
  parseTenant,
  serializeTenant,
  TenantSlugConflictError,
  type TenantId,
} from '../../../packages/shared/src/core/tenant.ts';

const validTenantInput = {
  id: '33333333-3333-7333-8333-333333333333',
  slug: 'acme-co',
  name: 'Acme Co',
  plan: 'pro' as const,
  region: 'eu' as const,
  createdAt: '2026-05-21T00:00:00Z',
  updatedAt: '2026-05-21T00:00:00Z',
};

describe('Tenant schema', () => {
  it('AC-1: parses a fully-specified valid tenant', () => {
    const parsed = Tenant.parse(validTenantInput);
    expect(parsed.slug).toBe('acme-co');
    expect(parsed.plan).toBe('pro');
    expect(parsed.region).toBe('eu');
    expect(parsed.deletedAt).toBeNull();
  });

  it('AC-2: rejects uppercase slug', () => {
    expect(() => Tenant.parse({ ...validTenantInput, slug: 'A-B' })).toThrow();
    expect(() => Tenant.parse({ ...validTenantInput, slug: 'Acme' })).toThrow();
  });

  it('AC-2: rejects slug shorter than min or longer than max', () => {
    expect(() => Tenant.parse({ ...validTenantInput, slug: 'a' })).toThrow();
    expect(() =>
      Tenant.parse({ ...validTenantInput, slug: 'a'.repeat(50) }),
    ).toThrow();
  });

  it('AC-2: rejects slug with leading or trailing hyphen', () => {
    expect(() => Tenant.parse({ ...validTenantInput, slug: '-abc' })).toThrow();
    expect(() => Tenant.parse({ ...validTenantInput, slug: 'abc-' })).toThrow();
  });

  it('AC-3: rejects unknown plan value', () => {
    expect(() =>
      Tenant.parse({ ...validTenantInput, plan: 'platinum' as unknown as TenantPlan }),
    ).toThrow();
    expect(() =>
      Tenant.parse({ ...validTenantInput, plan: 'gold' as unknown as TenantPlan }),
    ).toThrow();
  });

  it('AC-3: defaults plan to "free" when omitted', () => {
    const { plan, ...withoutPlan } = validTenantInput;
    void plan;
    const parsed = Tenant.parse(withoutPlan);
    expect(parsed.plan).toBe('free');
  });

  it('AC-3: accepts every value of TenantPlan enum', () => {
    for (const p of ['free', 'pro', 'team', 'enterprise'] as const) {
      const parsed = Tenant.parse({ ...validTenantInput, plan: p });
      expect(parsed.plan).toBe(p);
    }
  });

  it('AC-4: deletedAt defaults to null when omitted', () => {
    const parsed = Tenant.parse(validTenantInput);
    expect(parsed.deletedAt).toBeNull();
  });

  it('AC-4: deletedAt accepts an ISO datetime string', () => {
    const parsed = Tenant.parse({
      ...validTenantInput,
      deletedAt: '2026-06-01T12:00:00Z',
    });
    expect(parsed.deletedAt).toBe('2026-06-01T12:00:00Z');
  });

  it('rejects non-uuid id', () => {
    expect(() => Tenant.parse({ ...validTenantInput, id: 'not-uuid' })).toThrow();
  });

  it('rejects empty name', () => {
    expect(() => Tenant.parse({ ...validTenantInput, name: '' })).toThrow();
  });

  it('rejects name longer than 120 chars', () => {
    expect(() =>
      Tenant.parse({ ...validTenantInput, name: 'x'.repeat(121) }),
    ).toThrow();
  });

  it('defaults region to "global" when omitted', () => {
    const { region, ...withoutRegion } = validTenantInput;
    void region;
    const parsed = Tenant.parse(withoutRegion);
    expect(parsed.region).toBe('global');
  });

  it('AC-9: parseTenant(serializeTenant(x)) is stable', () => {
    const parsed = parseTenant(validTenantInput);
    const serialized = serializeTenant(parsed);
    const reparsed = parseTenant(serialized);
    expect(reparsed).toEqual(parsed);
  });

  it('parseTenant brands the id with TenantId', () => {
    const parsed = parseTenant(validTenantInput);
    // Compile-time invariant: this must type-check as TenantId.
    const id: TenantId = parsed.id;
    expect(typeof id).toBe('string');
    expect(id).toBe(validTenantInput.id as TenantId);
  });
});

describe('TenantSlugConflictError', () => {
  it('exposes the offending slug and a stable name', () => {
    const err = new TenantSlugConflictError('duplicate');
    expect(err.slug).toBe('duplicate');
    expect(err.name).toBe('TenantSlugConflictError');
    expect(err).toBeInstanceOf(Error);
  });
});
