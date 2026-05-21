/**
 * WT-05 — Organization zod schema, tenant binding, owner enforcement.
 *
 * TDD-first. Acceptance criteria mapping:
 *   AC-8 (org without owner → zod error),
 *   AC-9 (serialize round-trip stable).
 */

import { describe, expect, it } from 'bun:test';

import {
  Organization,
  parseOrganization,
  serializeOrganization,
  OrganizationOrphanError,
  type OrganizationId,
} from '../../../packages/shared/src/core/organization.ts';

const validOrgInput = {
  id: '44444444-4444-7444-8444-444444444444',
  tenantId: '33333333-3333-7333-8333-333333333333',
  name: 'Acme Engineering',
  ownerUserId: '55555555-5555-7555-8555-555555555555',
  settings: {
    defaultLocale: 'en',
    enforceMfa: false,
    ssoOnly: false,
  },
  createdAt: '2026-05-21T00:00:00',
};

describe('Organization schema', () => {
  it('parses a fully-specified valid organization', () => {
    const parsed = Organization.parse(validOrgInput);
    expect(parsed.name).toBe('Acme Engineering');
    expect(parsed.ownerUserId).toBe(validOrgInput.ownerUserId);
    expect(parsed.deletedAt).toBeNull();
  });

  it('AC-8: rejects organization without ownerUserId', () => {
    const { ownerUserId, ...withoutOwner } = validOrgInput;
    void ownerUserId;
    expect(() => Organization.parse(withoutOwner)).toThrow();
  });

  it('AC-8: rejects organization without tenantId', () => {
    const { tenantId, ...withoutTenant } = validOrgInput;
    void tenantId;
    expect(() => Organization.parse(withoutTenant)).toThrow();
  });

  it('rejects non-uuid tenantId', () => {
    expect(() =>
      Organization.parse({ ...validOrgInput, tenantId: 'not-a-uuid' }),
    ).toThrow();
  });

  it('rejects non-uuid ownerUserId', () => {
    expect(() =>
      Organization.parse({ ...validOrgInput, ownerUserId: '' }),
    ).toThrow();
  });

  it('defaults settings.defaultLocale to "en" when omitted', () => {
    const parsed = Organization.parse({
      ...validOrgInput,
      settings: { enforceMfa: true, ssoOnly: false },
    });
    expect(parsed.settings.defaultLocale).toBe('en');
    expect(parsed.settings.enforceMfa).toBe(true);
  });

  it('defaults settings entirely when omitted', () => {
    const { settings, ...withoutSettings } = validOrgInput;
    void settings;
    const parsed = Organization.parse(withoutSettings);
    expect(parsed.settings.defaultLocale).toBe('en');
    expect(parsed.settings.enforceMfa).toBe(false);
    expect(parsed.settings.ssoOnly).toBe(false);
  });

  it('rejects empty name', () => {
    expect(() => Organization.parse({ ...validOrgInput, name: '' })).toThrow();
  });

  it('rejects name longer than 120 chars', () => {
    expect(() =>
      Organization.parse({ ...validOrgInput, name: 'y'.repeat(121) }),
    ).toThrow();
  });

  it('deletedAt defaults to null and accepts ISO datetime', () => {
    const a = Organization.parse(validOrgInput);
    expect(a.deletedAt).toBeNull();
    const b = Organization.parse({ ...validOrgInput, deletedAt: '2026-06-01T00:00:00' });
    expect(b.deletedAt).toBe('2026-06-01T00:00:00');
  });

  it('AC-9: parseOrganization(serializeOrganization(x)) is stable', () => {
    const parsed = parseOrganization(validOrgInput);
    const serialized = serializeOrganization(parsed);
    const reparsed = parseOrganization(serialized);
    expect(reparsed).toEqual(parsed);
  });

  it('parseOrganization brands the id with OrganizationId', () => {
    const parsed = parseOrganization(validOrgInput);
    const id: OrganizationId = parsed.id;
    expect(typeof id).toBe('string');
    expect(id).toBe(validOrgInput.id as OrganizationId);
  });
});

describe('OrganizationOrphanError', () => {
  it('exposes the offending tenantId and stable name', () => {
    const err = new OrganizationOrphanError('missing-tenant');
    expect(err.tenantId).toBe('missing-tenant');
    expect(err.name).toBe('OrganizationOrphanError');
    expect(err).toBeInstanceOf(Error);
  });
});
