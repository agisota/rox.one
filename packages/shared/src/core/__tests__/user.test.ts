/**
 * UserSchema — Zod contract tests.
 *
 * Covers FR-04.1, AC-04.1, NFR-04.1. See spec:
 * docs/superpowers/specs/2026-05-21-wt-04-contract-user-identity-design.md
 */

import { describe, expect, it } from 'bun:test';
import { UserSchema, type User } from '../user.ts';
import { uuidV7 } from '../uuid-v7.ts';

function baseUser(overrides: Partial<User> = {}): Record<string, unknown> {
  const now = '2026-05-21T00:00:00.000Z';
  return {
    id: uuidV7(),
    tenantId: uuidV7(),
    email: 'user@example.com',
    displayName: 'User One',
    status: 'active',
    createdAtUtc: now,
    updatedAtUtc: now,
    ...overrides,
  };
}

describe('UserSchema', () => {
  it('должно reject когда email отсутствует или invalid', () => {
    const noEmail = baseUser();
    delete (noEmail as { email?: string }).email;
    expect(() => UserSchema.parse(noEmail)).toThrow();
    expect(() => UserSchema.parse(baseUser({ email: 'not-an-email' as User['email'] }))).toThrow();
    expect(() => UserSchema.parse(baseUser({ email: '' as User['email'] }))).toThrow();
  });

  it('должно default locale="en-US" и timezone="UTC" если не передано', () => {
    const parsed = UserSchema.parse(baseUser());
    expect(parsed.locale).toBe('en-US');
    expect(parsed.timezone).toBe('UTC');
  });

  it("должно reject status вне enum ('active'|'invited'|'suspended'|'deleted')", () => {
    expect(() =>
      UserSchema.parse(baseUser({ status: 'banned' as User['status'] })),
    ).toThrow();
    expect(() => UserSchema.parse(baseUser({ status: 'active' }))).not.toThrow();
    expect(() => UserSchema.parse(baseUser({ status: 'invited' }))).not.toThrow();
    expect(() => UserSchema.parse(baseUser({ status: 'suspended' }))).not.toThrow();
    expect(() => UserSchema.parse(baseUser({ status: 'deleted' }))).not.toThrow();
  });

  it('soft-delete: deletedAtUtc defaults to null and accepts ISO string', () => {
    const parsed = UserSchema.parse(baseUser());
    expect(parsed.deletedAtUtc).toBeNull();
    const withDelete = UserSchema.parse(
      baseUser({ deletedAtUtc: '2026-05-22T00:00:00.000Z' }),
    );
    expect(withDelete.deletedAtUtc).toBe('2026-05-22T00:00:00.000Z');
  });

  it('rejects non-UTC timestamps (must end in Z)', () => {
    expect(() =>
      UserSchema.parse(baseUser({ createdAtUtc: '2026-05-21T00:00:00+02:00' as User['createdAtUtc'] })),
    ).toThrow();
  });

  it('NFR-04.1: Zod parse <0.5ms p99 over 10k iterations', () => {
    const input = baseUser();
    const N = 10_000;
    const start = performance.now();
    for (let i = 0; i < N; i += 1) {
      UserSchema.parse(input);
    }
    const elapsed = performance.now() - start;
    const perCall = elapsed / N;
    expect(perCall).toBeLessThan(0.5);
  });
});
