/**
 * UserRepository — contract tests (Result-based, in-memory backend).
 *
 * Covers FR-04.5/.6/.7/.8, AC-04.5/.7/.9. See spec:
 * docs/superpowers/specs/2026-05-21-wt-04-contract-user-identity-design.md
 */

import { describe, expect, it } from 'bun:test';
import { DEFAULT_TENANT_ID, uuidV7 } from '@rox-one/shared/core';
import {
  UserRepository,
  hashEmailForAudit,
  type UserAuditEvent,
  type UserCreateInput,
} from '../user-repository.ts';

function freshInput(overrides: Partial<UserCreateInput> = {}): UserCreateInput {
  const now = '2026-05-21T00:00:00.000Z';
  return {
    id: uuidV7(),
    email: 'user@example.com',
    displayName: 'User One',
    createdAtUtc: now,
    updatedAtUtc: now,
    ...overrides,
  };
}

describe('UserRepository', () => {
  it('должно inject DEFAULT_TENANT_ID когда tenant-v1 flag OFF и tenantId не передан', () => {
    const repo = new UserRepository({ tenantFlagOn: false });
    const result = repo.create(freshInput());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.tenantId).toBe(DEFAULT_TENANT_ID);
    }
  });

  it('должно return Err когда email duplicate per tenant', () => {
    const repo = new UserRepository();
    const a = repo.create(freshInput({ id: uuidV7(), email: 'dup@example.com' }));
    expect(a.ok).toBe(true);
    const b = repo.create(freshInput({ id: uuidV7(), email: 'dup@example.com' }));
    expect(b.ok).toBe(false);
    if (!b.ok) expect(b.error.code).toBe('duplicate');
  });

  it('emits user.created and user.soft-deleted audit events with hashed email', () => {
    const events: UserAuditEvent[] = [];
    const repo = new UserRepository({ auditSink: (e) => events.push(e) });
    const created = repo.create(freshInput({ email: 'audit@example.com' }));
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const deleted = repo.softDelete(created.value.id, '2026-05-22T00:00:00.000Z');
    expect(deleted.ok).toBe(true);
    expect(events.map((e) => e.type)).toEqual(['user.created', 'user.soft-deleted']);
    // PII safety: emailHash must NOT contain raw email substring.
    for (const e of events) {
      expect(e.emailHash).not.toContain('@');
      expect(e.emailHash).toBe(hashEmailForAudit('audit@example.com'));
    }
  });

  it('list() skips soft-deleted rows by default and includes when requested', () => {
    const repo = new UserRepository();
    const a = repo.create(freshInput({ id: uuidV7(), email: 'a@example.com' }));
    const b = repo.create(freshInput({ id: uuidV7(), email: 'b@example.com' }));
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    repo.softDelete(a.value.id, '2026-05-22T00:00:00.000Z');

    const live = repo.list();
    expect(live.ok).toBe(true);
    if (live.ok) {
      expect(live.value.map((u) => u.id)).toEqual([b.value.id]);
    }

    const all = repo.list({ includeDeleted: true });
    expect(all.ok).toBe(true);
    if (all.ok) {
      expect(all.value.map((u) => u.id).sort()).toEqual(
        [a.value.id, b.value.id].sort(),
      );
    }
  });

  it('register() respects feature flag', () => {
    const off = new UserRepository({ featureFlagOn: false });
    expect(off.register()).toBe(false);
    expect(off.isRegistered()).toBe(false);

    const on = new UserRepository({ featureFlagOn: true });
    expect(on.register()).toBe(true);
    expect(on.isRegistered()).toBe(true);
  });

  it('update() bumps updatedAtUtc and re-validates output', () => {
    const repo = new UserRepository();
    const created = repo.create(freshInput());
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const next = repo.update(created.value.id, {
      displayName: 'Renamed',
      updatedAtUtc: '2026-05-22T00:00:00.000Z',
    });
    expect(next.ok).toBe(true);
    if (next.ok) {
      expect(next.value.displayName).toBe('Renamed');
      expect(next.value.updatedAtUtc).toBe('2026-05-22T00:00:00.000Z');
    }
  });

  it('restore() reverts soft-delete and emits user.restored', () => {
    const events: UserAuditEvent[] = [];
    const repo = new UserRepository({ auditSink: (e) => events.push(e) });
    const created = repo.create(freshInput());
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    repo.softDelete(created.value.id, '2026-05-22T00:00:00.000Z');
    const restored = repo.restore(created.value.id, '2026-05-23T00:00:00.000Z');
    expect(restored.ok).toBe(true);
    if (restored.ok) {
      expect(restored.value.deletedAtUtc).toBeNull();
      expect(restored.value.status).toBe('active');
    }
    expect(events.map((e) => e.type)).toContain('user.restored');
  });

  it('findByEmail returns Err with code=not-found when missing', () => {
    const repo = new UserRepository();
    const r = repo.findByEmail(DEFAULT_TENANT_ID, 'nobody@example.com');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('not-found');
  });

  it('AC-04.7: tenant-v1 flag ON requires explicit tenantId', () => {
    const repo = new UserRepository({ tenantFlagOn: true });
    const result = repo.create(freshInput());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('invalid-input');
  });
});
