/**
 * T244 — schema-layer reservation of `'*'` as a forbidden workspace
 * `scopeId`. Covers `validateRoleGrant`, the throwing variant
 * `assertValidRoleGrant`, and the plumbing through `InMemoryGrantStore`
 * so the runtime cannot persist a smuggled grant.
 *
 * Coverage: every `RoleGrantValidationCode` reject path, happy paths
 * across role × scope-kind matrix, and the grant-store mutation
 * boundary. ≥30 expect() calls. No I/O, no network, deterministic.
 */

import { describe, it, expect } from 'bun:test';
import {
  validateRoleGrant,
  assertValidRoleGrant,
  RESERVED_WORKSPACE_SENTINEL_ID,
  VALID_ACTOR_KINDS,
  VALID_SCOPE_KINDS,
  type RoleGrant,
  type RoleGrantValidationCode,
} from '../roles-schema.ts';
import { PERMITTED_WORKSPACES_GLOBAL_SENTINEL } from '../policy-engine.ts';
import { InMemoryGrantStore } from '../rbac-resolver.ts';

// Uses `in`-checks so callers can deliberately pass `undefined`/`null`.
function makeGrant(over: Partial<RoleGrant> = {}): RoleGrant {
  return {
    roleId: 'roleId' in over ? (over.roleId as string) : 'editor',
    actorKind: 'actorKind' in over ? (over.actorKind as 'user' | 'team') : 'user',
    actorId: 'actorId' in over ? (over.actorId as string) : 'u1',
    scopeKind:
      'scopeKind' in over ? (over.scopeKind as RoleGrant['scopeKind']) : 'workspace',
    scopeId: 'scopeId' in over ? (over.scopeId as string | null) : 'W1',
  };
}

function expectReject(grant: RoleGrant, code: RoleGrantValidationCode): void {
  const result = validateRoleGrant(grant);
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.error.code).toBe(code);
  expect(result.error.message.length).toBeGreaterThan(0);
}

describe('T244 — exported constants', () => {
  it('RESERVED_WORKSPACE_SENTINEL_ID mirrors the policy-engine global sentinel', () => {
    expect(RESERVED_WORKSPACE_SENTINEL_ID).toBe('*');
    expect(RESERVED_WORKSPACE_SENTINEL_ID).toBe(PERMITTED_WORKSPACES_GLOBAL_SENTINEL);
  });

  it('VALID_ACTOR_KINDS is frozen and lists user, team', () => {
    expect([...VALID_ACTOR_KINDS].sort()).toEqual(['team', 'user']);
    expect(Object.isFrozen(VALID_ACTOR_KINDS)).toBe(true);
  });

  it('VALID_SCOPE_KINDS is frozen and lists workspace, org, global', () => {
    expect([...VALID_SCOPE_KINDS].sort()).toEqual(['global', 'org', 'workspace']);
    expect(Object.isFrozen(VALID_SCOPE_KINDS)).toBe(true);
  });
});

describe('T244 — reserved-scope-id rejection (Finding A close)', () => {
  it('rejects workspace and org grants with scopeId === "*"', () => {
    expectReject(makeGrant({ scopeKind: 'workspace', scopeId: '*' }), 'reserved-scope-id');
    expectReject(makeGrant({ scopeKind: 'org', scopeId: '*' }), 'reserved-scope-id');
  });

  it('rejects "*" across all system + custom roleIds and both actorKinds', () => {
    for (const roleId of ['owner', 'editor', 'viewer', 'reviewer']) {
      for (const actorKind of ['user', 'team'] as const) {
        expectReject(
          makeGrant({ roleId, actorKind, scopeKind: 'workspace', scopeId: '*' }),
          'reserved-scope-id',
        );
      }
    }
  });

  it('error message names the reserved sentinel and offending scopeKind', () => {
    const result = validateRoleGrant(makeGrant({ scopeKind: 'workspace', scopeId: '*' }));
    if (result.ok) throw new Error('expected rejection');
    expect(result.error.message).toContain("'*'");
    expect(result.error.message).toContain('workspace');
  });

  it('does NOT reject scope-id lookalikes (only the literal "*" is reserved)', () => {
    for (const id of ['*abc', '**', 'foo*', '*-tail', '-*', 'star']) {
      const result = validateRoleGrant(makeGrant({ scopeKind: 'workspace', scopeId: id }));
      expect(result.ok).toBe(true);
    }
  });
});

describe('T244 — scope-id shape rejection', () => {
  it('rejects empty-string scopeId on workspace and org', () => {
    expectReject(makeGrant({ scopeKind: 'workspace', scopeId: '' }), 'empty-scope-id');
    expectReject(makeGrant({ scopeKind: 'org', scopeId: '' }), 'empty-scope-id');
  });

  it('rejects null scopeId on workspace and org (scoped-without-id)', () => {
    expectReject(makeGrant({ scopeKind: 'workspace', scopeId: null }), 'scoped-without-id');
    expectReject(makeGrant({ scopeKind: 'org', scopeId: null }), 'scoped-without-id');
  });

  it('rejects non-string scopeId (number, object)', () => {
    expectReject(
      makeGrant({ scopeKind: 'workspace', scopeId: 42 as unknown as string }),
      'non-string-scope-id',
    );
    expectReject(
      makeGrant({ scopeKind: 'workspace', scopeId: { x: 1 } as unknown as string }),
      'non-string-scope-id',
    );
  });
});

describe('T244 — global scope discipline', () => {
  it('rejects global grant with non-null scopeId (including "*" and "")', () => {
    expectReject(
      makeGrant({ scopeKind: 'global', scopeId: 'something' }),
      'global-scope-with-id',
    );
    expectReject(
      makeGrant({ scopeKind: 'global', scopeId: '' }),
      'global-scope-with-id',
    );
    expectReject(
      makeGrant({ scopeKind: 'global', scopeId: '*' }),
      'global-scope-with-id',
    );
  });

  it('accepts global grant with scopeId === null', () => {
    const result = validateRoleGrant(makeGrant({ scopeKind: 'global', scopeId: null }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.grant.scopeKind).toBe('global');
    expect(result.grant.scopeId).toBeNull();
  });
});

describe('T244 — discriminant validation', () => {
  it('rejects unknown / undefined scopeKind values', () => {
    expectReject(
      makeGrant({ scopeKind: 'whatever' as unknown as 'workspace', scopeId: 'W1' }),
      'unknown-scope-kind',
    );
    expectReject(
      makeGrant({ scopeKind: undefined as unknown as 'workspace', scopeId: 'W1' }),
      'unknown-scope-kind',
    );
  });

  it('rejects unknown / undefined actorKind values', () => {
    expectReject(makeGrant({ actorKind: 'bot' as unknown as 'user' }), 'unknown-actor-kind');
    expectReject(
      makeGrant({ actorKind: undefined as unknown as 'user' }),
      'unknown-actor-kind',
    );
  });

  it('rejects empty / non-string roleId and actorId', () => {
    expectReject(makeGrant({ roleId: '' }), 'empty-role-id');
    expectReject(makeGrant({ roleId: 123 as unknown as string }), 'empty-role-id');
    expectReject(makeGrant({ actorId: '' }), 'empty-actor-id');
    expectReject(makeGrant({ actorId: null as unknown as string }), 'empty-actor-id');
  });
});

describe('T244 — happy path acceptance', () => {
  it('accepts a workspace editor grant by reference (no clone)', () => {
    const grant = makeGrant({ scopeKind: 'workspace', scopeId: 'W1' });
    const result = validateRoleGrant(grant);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.grant).toBe(grant);
  });

  it('accepts org team grants and custom role ids', () => {
    const grant = makeGrant({
      roleId: 'reviewer',
      actorKind: 'team',
      actorId: 'team-9',
      scopeKind: 'org',
      scopeId: 'org-1',
    });
    const result = validateRoleGrant(grant);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.grant.actorKind).toBe('team');
    expect(result.grant.roleId).toBe('reviewer');
  });

  it('accepts every system role × every scope kind matrix', () => {
    const matrix: ReadonlyArray<{ scopeKind: RoleGrant['scopeKind']; scopeId: string | null }> = [
      { scopeKind: 'workspace', scopeId: 'W1' },
      { scopeKind: 'org', scopeId: 'O1' },
      { scopeKind: 'global', scopeId: null },
    ];
    for (const roleId of ['owner', 'editor', 'viewer'] as const) {
      for (const cell of matrix) {
        const result = validateRoleGrant(makeGrant({ roleId, ...cell }));
        expect(result.ok).toBe(true);
      }
    }
  });
});

describe('T244 — assertValidRoleGrant (throwing variant)', () => {
  it('returns the grant verbatim when valid', () => {
    const grant = makeGrant({ scopeKind: 'workspace', scopeId: 'W1' });
    expect(assertValidRoleGrant(grant)).toBe(grant);
  });

  it('throws Error with embedded code in message and on .code property', () => {
    expect(() =>
      assertValidRoleGrant(makeGrant({ scopeKind: 'workspace', scopeId: '*' })),
    ).toThrow(/reserved-scope-id/);
    try {
      assertValidRoleGrant(makeGrant({ scopeKind: 'workspace', scopeId: '*' }));
      throw new Error('expected throw');
    } catch (err) {
      const e = err as Error & { code?: string };
      expect(e.code).toBe('reserved-scope-id');
    }
  });

  it('throws with correct code for empty roleId', () => {
    try {
      assertValidRoleGrant(makeGrant({ roleId: '' }));
      throw new Error('expected throw');
    } catch (err) {
      const e = err as Error & { code?: string };
      expect(e.code).toBe('empty-role-id');
    }
  });
});

describe('T244 — InMemoryGrantStore enforces validator at mutation boundary', () => {
  it('constructor rejects seed with smuggled "*" workspace grant', () => {
    expect(
      () => new InMemoryGrantStore([makeGrant({ scopeKind: 'workspace', scopeId: '*' })]),
    ).toThrow(/reserved-scope-id/);
  });

  it('constructor rejects seed with global grant carrying non-null scopeId', () => {
    expect(
      () => new InMemoryGrantStore([makeGrant({ scopeKind: 'global', scopeId: 'oops' })]),
    ).toThrow(/global-scope-with-id/);
  });

  it('constructor accepts a clean seed', () => {
    const store = new InMemoryGrantStore([
      makeGrant({ scopeKind: 'workspace', scopeId: 'W1' }),
      makeGrant({ scopeKind: 'global', scopeId: null }),
    ]);
    expect(store).toBeDefined();
  });

  it('grant() rejects smuggled "*" workspace grant and persists nothing', async () => {
    const store = new InMemoryGrantStore();
    let caught: unknown = null;
    try {
      await store.grant(makeGrant({ scopeKind: 'workspace', scopeId: '*' }));
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error & { code?: string }).code).toBe('reserved-scope-id');
    expect(await store.grantsForUser('u1')).toEqual([]);
  });

  it('grant() rejects empty / global-with-id / unknown-scope-kind violations', async () => {
    const store = new InMemoryGrantStore();
    await expect(
      store.grant(makeGrant({ scopeKind: 'workspace', scopeId: '' })),
    ).rejects.toThrow(/empty-scope-id/);
    await expect(
      store.grant(makeGrant({ scopeKind: 'global', scopeId: 'leaked' })),
    ).rejects.toThrow(/global-scope-with-id/);
    await expect(
      store.grant(
        makeGrant({ scopeKind: 'bogus' as unknown as 'workspace', scopeId: 'W1' }),
      ),
    ).rejects.toThrow(/unknown-scope-kind/);
  });

  it('grant() accepts clean workspace grants end-to-end', async () => {
    const store = new InMemoryGrantStore();
    await store.grant(makeGrant({ scopeKind: 'workspace', scopeId: 'W1' }));
    const grants = await store.grantsForUser('u1');
    expect(grants).toHaveLength(1);
    expect(grants[0]?.scopeId).toBe('W1');
  });

  it('revoke() is permissive — operators can clean up pre-T244 legacy grants', async () => {
    // Backward-compat hatch: revoke() does not validate, so legacy
    // grants persisted before T244 can be removed via the normal API.
    const store = new InMemoryGrantStore();
    const result = await store.revoke(makeGrant({ scopeKind: 'workspace', scopeId: '*' }));
    expect(result).toBe(false);
  });
});

describe('T244 — defensive shape guard + purity', () => {
  it('rejects non-object grants (null, string, undefined)', () => {
    expect(validateRoleGrant(null as unknown as RoleGrant).ok).toBe(false);
    expect(validateRoleGrant('nope' as unknown as RoleGrant).ok).toBe(false);
    expect(validateRoleGrant(undefined as unknown as RoleGrant).ok).toBe(false);
  });

  it('does not mutate input and returns the same instance on success', () => {
    const grant = makeGrant({ scopeKind: 'workspace', scopeId: 'W1' });
    const snapshot = JSON.stringify(grant);
    const result = validateRoleGrant(grant);
    expect(JSON.stringify(grant)).toBe(snapshot);
    if (!result.ok) throw new Error('expected acceptance');
    expect(result.grant).toBe(grant);
  });

  it('is deterministic across repeated calls', () => {
    const grant = makeGrant({ scopeKind: 'workspace', scopeId: '*' });
    const r1 = validateRoleGrant(grant);
    const r2 = validateRoleGrant(grant);
    expect(r1.ok).toBe(r2.ok);
    if (!r1.ok && !r2.ok) {
      expect(r1.error.code).toBe(r2.error.code);
    }
  });
});
