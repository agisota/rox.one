/**
 * IdentityRepository — contract tests.
 *
 * Covers FR-04.2, FR-04.6, AC-04.6, AC-04.8 (5 audit event types).
 * See spec:
 * docs/superpowers/specs/2026-05-21-wt-04-contract-user-identity-design.md
 */

import { describe, expect, it } from 'bun:test';
import { uuidV7 } from '@rox-one/shared/core';
import {
  IdentityRepository,
  type IdentityAuditEvent,
  type IdentityCreateInput,
} from '../identity-repository.ts';

function baseIdentity(overrides: Partial<IdentityCreateInput> = {}): IdentityCreateInput {
  return {
    id: uuidV7(),
    userId: uuidV7(),
    tenantId: uuidV7(),
    provider: 'google',
    externalId: 'google-sub-abc123',
    createdAtUtc: '2026-05-21T00:00:00.000Z',
    ...overrides,
  };
}

describe('IdentityRepository', () => {
  it('должно findByProviderExternalId(google, "abc123", tenantId) корректно scoped', () => {
    const repo = new IdentityRepository();
    const tenantA = uuidV7();
    const tenantB = uuidV7();
    const userA = uuidV7();
    const userB = uuidV7();
    const created = repo.create(
      baseIdentity({
        userId: userA,
        tenantId: tenantA,
        externalId: 'abc123',
      }),
    );
    expect(created.ok).toBe(true);
    // Same external_id in a different tenant — must be a different identity.
    const createdB = repo.create(
      baseIdentity({
        userId: userB,
        tenantId: tenantB,
        externalId: 'abc123',
      }),
    );
    expect(createdB.ok).toBe(true);

    const foundA = repo.findByProviderExternalId('google', 'abc123', tenantA);
    expect(foundA.ok).toBe(true);
    if (foundA.ok) expect(foundA.value.userId).toBe(userA);

    const foundB = repo.findByProviderExternalId('google', 'abc123', tenantB);
    expect(foundB.ok).toBe(true);
    if (foundB.ok) expect(foundB.value.userId).toBe(userB);
  });

  it('должно emit audit event identity.linked при linkToUser', () => {
    const events: IdentityAuditEvent[] = [];
    const repo = new IdentityRepository({ auditSink: (e) => events.push(e) });
    const a = repo.create(baseIdentity());
    expect(a.ok).toBe(true);
    if (!a.ok) return;
    const newUserId = uuidV7();
    const relinked = repo.linkToUser(a.value.id, newUserId, '2026-05-22T00:00:00.000Z');
    expect(relinked.ok).toBe(true);
    if (relinked.ok) expect(relinked.value.userId).toBe(newUserId);
    expect(events.map((e) => e.type)).toEqual(['identity.linked', 'identity.linked']);
  });

  it('emits identity.unlinked when unlinkFromUser is called', () => {
    const events: IdentityAuditEvent[] = [];
    const repo = new IdentityRepository({ auditSink: (e) => events.push(e) });
    const a = repo.create(baseIdentity());
    expect(a.ok).toBe(true);
    if (!a.ok) return;
    repo.unlinkFromUser(a.value.id, '2026-05-22T00:00:00.000Z');
    expect(events.map((e) => e.type)).toContain('identity.unlinked');
  });

  it('returns duplicate when (tenant, provider, externalId) conflicts', () => {
    const repo = new IdentityRepository();
    const tenant = uuidV7();
    const a = repo.create(baseIdentity({ tenantId: tenant, externalId: 'shared' }));
    expect(a.ok).toBe(true);
    const b = repo.create(baseIdentity({ tenantId: tenant, externalId: 'shared' }));
    expect(b.ok).toBe(false);
    if (!b.ok) expect(b.error.code).toBe('duplicate');
  });

  it('listByUser excludes soft-deleted identities', () => {
    const repo = new IdentityRepository();
    const userId = uuidV7();
    const a = repo.create(baseIdentity({ userId, externalId: 'a' }));
    const b = repo.create(baseIdentity({ userId, externalId: 'b' }));
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    repo.unlinkFromUser(a.value.id, '2026-05-22T00:00:00.000Z');
    const list = repo.listByUser(userId);
    expect(list.ok).toBe(true);
    if (list.ok) {
      expect(list.value.map((x) => x.id)).toEqual([b.value.id]);
    }
  });

  it('register() respects feature flag', () => {
    const off = new IdentityRepository({ featureFlagOn: false });
    expect(off.register()).toBe(false);
    const on = new IdentityRepository({ featureFlagOn: true });
    expect(on.register()).toBe(true);
  });

  it('rejects oversized claims (>16KB)', () => {
    const repo = new IdentityRepository();
    const r = repo.create(
      baseIdentity({ claims: { big: 'x'.repeat(17 * 1024) } }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('invalid-input');
  });
});
