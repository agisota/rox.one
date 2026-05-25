/**
 * Tests for QuotaAccount — consumption tracking + auto-reset on period boundary.
 *
 * Covers AC-7..AC-10 from spec §5 and items 4/5 from §6.
 */

import { describe, expect, it } from 'bun:test';
import {
  peek,
  QuotaAccountSchema,
  release,
  tryConsume,
  type QuotaAccount,
} from '../../../packages/shared/src/feature-flags/quota-account.ts';

const TENANT = '11111111-1111-4111-8111-111111111111';
const USER = '22222222-2222-4222-8222-222222222222';
const WORKSPACE = '33333333-3333-4333-8333-333333333333';

function makeAccount(overrides: Partial<QuotaAccount> = {}): QuotaAccount {
  return QuotaAccountSchema.parse({
    id: '00000000-0000-4000-8000-000000000099',
    scope: { kind: 'tenant', tenantId: TENANT },
    resource: 'agent_runs_per_day',
    used: 95,
    limit: 100,
    period: 'day',
    periodStart: '2026-05-21T00:00:00',
    updatedAt: '2026-05-21T00:00:00',
    ...overrides,
  });
}

describe('QuotaAccount schema', () => {
  it('AC-10: parses tenant scope', () => {
    const acc = makeAccount();
    expect(acc.scope.kind).toBe('tenant');
    if (acc.scope.kind === 'tenant') {
      expect(acc.scope.tenantId).toBe(TENANT);
    }
  });

  it('AC-10: parses user scope', () => {
    const acc = makeAccount({ scope: { kind: 'user', userId: USER } });
    expect(acc.scope.kind).toBe('user');
    if (acc.scope.kind === 'user') {
      expect(acc.scope.userId).toBe(USER);
    }
  });

  it('AC-10: parses workspace scope', () => {
    const acc = makeAccount({ scope: { kind: 'workspace', workspaceId: WORKSPACE } });
    expect(acc.scope.kind).toBe('workspace');
    if (acc.scope.kind === 'workspace') {
      expect(acc.scope.workspaceId).toBe(WORKSPACE);
    }
  });

  it('rejects negative used or limit', () => {
    expect(() => makeAccount({ used: -1 })).toThrow();
    expect(() => makeAccount({ limit: -1 })).toThrow();
  });
});

describe('tryConsume', () => {
  const NOW = new Date('2026-05-21T10:00:00Z');

  it('AC-7: rejects consume that would overflow the limit', () => {
    const acc = makeAccount({ used: 95, limit: 100 });
    const audited: unknown[] = [];
    const result = tryConsume(acc, 10, {
      now: NOW,
      audit: (e) => {
        audited.push(e);
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.retryAfter).toBeDefined();
    }
    expect(audited.length).toBe(1);
  });

  it('AC-8: accepts consume that exactly hits the limit', () => {
    const acc = makeAccount({ used: 95, limit: 100 });
    const audited: unknown[] = [];
    const result = tryConsume(acc, 5, {
      now: NOW,
      audit: (e) => {
        audited.push(e);
      },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.account.used).toBe(100);
    }
    expect(audited.length).toBe(1);
  });

  it('consumes incrementally and rejects last overflow', () => {
    let acc = makeAccount({ used: 0, limit: 10 });
    for (let i = 0; i < 5; i += 1) {
      const result = tryConsume(acc, 2, { now: NOW });
      expect(result.ok).toBe(true);
      if (result.ok) {
        acc = result.account;
      }
    }
    expect(acc.used).toBe(10);
    const denied = tryConsume(acc, 1, { now: NOW });
    expect(denied.ok).toBe(false);
  });

  it('rejects non-positive amount', () => {
    const acc = makeAccount();
    expect(() => tryConsume(acc, 0, { now: NOW })).toThrow();
    expect(() => tryConsume(acc, -1, { now: NOW })).toThrow();
  });

  it('AC-9: auto-resets `used` when period elapsed (day)', () => {
    const acc = makeAccount({
      used: 95,
      limit: 100,
      period: 'day',
      periodStart: '2026-05-19T00:00:00',
    });
    const result = tryConsume(acc, 10, { now: new Date('2026-05-21T01:00:00Z') });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.account.used).toBe(10);
      expect(result.account.periodStart).not.toBe('2026-05-19T00:00:00');
    }
  });

  it('auto-resets `used` for hourly period after 2h gap', () => {
    const acc = makeAccount({
      used: 99,
      limit: 100,
      period: 'hour',
      periodStart: '2026-05-21T08:00:00',
    });
    const result = tryConsume(acc, 5, { now: new Date('2026-05-21T10:00:00Z') });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.account.used).toBe(5);
    }
  });

  it('lifetime period never resets', () => {
    const acc = makeAccount({
      used: 100,
      limit: 100,
      period: 'lifetime',
      periodStart: '2020-01-01T00:00:00',
    });
    const result = tryConsume(acc, 1, { now: new Date('2099-01-01T00:00:00Z') });
    expect(result.ok).toBe(false);
  });
});

describe('release', () => {
  const NOW = new Date('2026-05-21T10:00:00Z');

  it('decrements used and clamps at zero', () => {
    const acc = makeAccount({ used: 5 });
    const updated = release(acc, 3, { now: NOW });
    expect(updated.used).toBe(2);
    const clamped = release(updated, 10, { now: NOW });
    expect(clamped.used).toBe(0);
  });

  it('throws on non-positive amount', () => {
    expect(() => release(makeAccount(), 0, { now: NOW })).toThrow();
  });
});

describe('peek', () => {
  it('reports remaining without mutating', () => {
    const acc = makeAccount({ used: 30, limit: 100 });
    const view = peek(acc, { now: new Date('2026-05-21T10:00:00Z') });
    expect(view.used).toBe(30);
    expect(view.remaining).toBe(70);
    expect(view.resetAt).toBeDefined();
  });

  it('applies period reset before reporting', () => {
    const acc = makeAccount({
      used: 95,
      limit: 100,
      period: 'hour',
      periodStart: '2026-05-21T08:00:00',
    });
    const view = peek(acc, { now: new Date('2026-05-21T10:30:00Z') });
    expect(view.used).toBe(0);
    expect(view.remaining).toBe(100);
  });
});
