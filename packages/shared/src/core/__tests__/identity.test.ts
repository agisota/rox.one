/**
 * IdentitySchema — Zod contract tests.
 *
 * Covers FR-04.2. See spec:
 * docs/superpowers/specs/2026-05-21-wt-04-contract-user-identity-design.md
 */

import { describe, expect, it } from 'bun:test';
import { IdentitySchema, IDENTITY_CLAIMS_MAX_BYTES, type Identity } from '../identity.ts';
import { uuidV7 } from '../uuid-v7.ts';

function baseIdentity(overrides: Partial<Identity> = {}): Record<string, unknown> {
  const now = '2026-05-21T00:00:00.000Z';
  return {
    id: uuidV7(),
    userId: uuidV7(),
    tenantId: uuidV7(),
    provider: 'google',
    externalId: 'google-sub-abc123',
    claims: { sub: 'google-sub-abc123', email_verified: true },
    createdAtUtc: now,
    ...overrides,
  };
}

describe('IdentitySchema', () => {
  it('должно reject когда claims >16KB serialized', () => {
    // Pad with a string that serializes to >16KB.
    const big = 'x'.repeat(IDENTITY_CLAIMS_MAX_BYTES + 1);
    expect(() =>
      IdentitySchema.parse(baseIdentity({ claims: { big } })),
    ).toThrow();
    // Boundary: 1 KB claims should pass.
    expect(() =>
      IdentitySchema.parse(baseIdentity({ claims: { ok: 'x'.repeat(1024) } })),
    ).not.toThrow();
  });

  it('rejects unknown provider value', () => {
    expect(() =>
      IdentitySchema.parse(baseIdentity({ provider: 'github' as Identity['provider'] })),
    ).toThrow();
  });

  it('accepts all six providers', () => {
    for (const p of ['google', 'slack', 'microsoft', 'anthropic-oauth', 'scim', 'rox-local'] as const) {
      expect(() => IdentitySchema.parse(baseIdentity({ provider: p }))).not.toThrow();
    }
  });

  it('defaults primary=false and deletedAtUtc=null and lastSeenAtUtc=null', () => {
    const parsed = IdentitySchema.parse(baseIdentity());
    expect(parsed.primary).toBe(false);
    expect(parsed.deletedAtUtc).toBeNull();
    expect(parsed.lastSeenAtUtc).toBeNull();
  });

  it('rejects empty externalId', () => {
    expect(() =>
      IdentitySchema.parse(baseIdentity({ externalId: '' as Identity['externalId'] })),
    ).toThrow();
  });
});
