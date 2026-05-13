/**
 * Integrity-pass tests (M.13 T052 extension).
 *
 * Asserts that tampering with any persisted or in-flight integrity-bearing
 * payload is detected. Boundary unit tests only — no RPC wiring.
 *
 * Surfaces under test (cross-ref `docs/release/security-integrity-audit.md`):
 *   #1, #2  — RoleGrant validator + reserved sentinel
 *   #4, #5  — Policy engine + permittedWorkspaces frozen output
 *   #6, #7  — Audit hash chain + payload sanitization
 *
 * No source files are modified; these only exercise existing public APIs.
 */

import { describe, test, expect } from 'bun:test';
import { InMemoryGrantStore, RbacResolver } from '../rbac-resolver.ts';
import {
  evaluate,
  permittedWorkspaces,
  PERMITTED_WORKSPACES_GLOBAL_SENTINEL,
} from '../policy-engine.ts';
import {
  validateRoleGrant,
  assertValidRoleGrant,
  RESERVED_WORKSPACE_SENTINEL_ID,
  type RoleGrant,
} from '../roles-schema.ts';
import {
  InMemoryAuditEventStore,
  verifyAuditHashChain,
  serializeAuditPayload,
  type AuditEventRecord,
} from '../../audit/audit-event-store.ts';

// Helpers ──────────────────────────────────────────────────────────────
const ownerWs = (actorId: string, scopeId: string): RoleGrant => ({
  roleId: 'owner', actorKind: 'user', actorId, scopeKind: 'workspace', scopeId,
});

function expectInvalid(g: RoleGrant, code: string) {
  const r = validateRoleGrant(g);
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.error.code).toBe(code);
}

// ── #1/#2 RBAC grant tampering ────────────────────────────────────────

describe('integrity: RoleGrant validator rejects tampered payloads', () => {
  test('reserved sentinel scopeId rejected on workspace grant', () => {
    expectInvalid(
      { roleId: 'viewer', actorKind: 'user', actorId: 'u-1', scopeKind: 'workspace', scopeId: RESERVED_WORKSPACE_SENTINEL_ID },
      'reserved-scope-id',
    );
  });

  test('reserved sentinel scopeId rejected on org grant', () => {
    expectInvalid(
      { roleId: 'viewer', actorKind: 'user', actorId: 'u-1', scopeKind: 'org', scopeId: RESERVED_WORKSPACE_SENTINEL_ID },
      'reserved-scope-id',
    );
  });

  test('global grant with populated scopeId rejected (smuggled scope)', () => {
    expectInvalid(
      { roleId: 'owner', actorKind: 'user', actorId: 'u-1', scopeKind: 'global', scopeId: 'ws-leak' },
      'global-scope-with-id',
    );
  });

  test('workspace grant with null scopeId rejected (broadened scope)', () => {
    expectInvalid(
      { roleId: 'editor', actorKind: 'user', actorId: 'u-1', scopeKind: 'workspace', scopeId: null } as unknown as RoleGrant,
      'scoped-without-id',
    );
  });

  test('empty roleId rejected', () => {
    expectInvalid(
      { roleId: '', actorKind: 'user', actorId: 'u-1', scopeKind: 'workspace', scopeId: 'ws-1' } as RoleGrant,
      'empty-role-id',
    );
  });

  test('empty actorId rejected', () => {
    expectInvalid(
      { roleId: 'viewer', actorKind: 'user', actorId: '', scopeKind: 'workspace', scopeId: 'ws-1' } as RoleGrant,
      'empty-actor-id',
    );
  });

  test('non-string scopeId rejected (JSON tamper)', () => {
    expectInvalid(
      { roleId: 'viewer', actorKind: 'user', actorId: 'u-1', scopeKind: 'workspace', scopeId: 42 as unknown as string } as RoleGrant,
      'non-string-scope-id',
    );
  });

  test('assertValidRoleGrant throws with stable error.code', () => {
    let captured: unknown;
    try {
      assertValidRoleGrant({
        roleId: 'owner', actorKind: 'user', actorId: 'u-1',
        scopeKind: 'workspace', scopeId: RESERVED_WORKSPACE_SENTINEL_ID,
      });
    } catch (e) { captured = e; }
    expect(captured).toBeInstanceOf(Error);
    expect((captured as { code?: string }).code).toBe('reserved-scope-id');
  });

  test('InMemoryGrantStore.grant() rejects tampered grant at runtime', async () => {
    const store = new InMemoryGrantStore();
    await expect(
      store.grant({
        roleId: 'owner', actorKind: 'user', actorId: 'u-1',
        scopeKind: 'workspace', scopeId: RESERVED_WORKSPACE_SENTINEL_ID,
      }),
    ).rejects.toThrow(/reserved-scope-id/);
    expect((await store.grantsForUser('u-1')).length).toBe(0);
  });

  test('InMemoryGrantStore constructor rejects tampered seed grant', () => {
    expect(
      () => new InMemoryGrantStore([
        { roleId: 'owner', actorKind: 'user', actorId: 'u-1', scopeKind: 'global', scopeId: 'ws-leak' },
      ]),
    ).toThrow(/global-scope-with-id/);
  });
});

// ── permittedWorkspaces output is frozen + sentinel-safe ──────────────

describe('integrity: permittedWorkspaces resists sentinel smuggling', () => {
  test('real global owner grant produces sentinel once', () => {
    const out = permittedWorkspaces([
      { roleId: 'owner', actorKind: 'user', actorId: 'u-1', scopeKind: 'global', scopeId: null },
    ]);
    expect(out).toEqual([PERMITTED_WORKSPACES_GLOBAL_SENTINEL]);
    expect(out.length).toBe(1);
  });

  test('returned array is frozen', () => {
    const out = permittedWorkspaces([ownerWs('u-1', 'ws-a')]);
    expect(Object.isFrozen(out)).toBe(true);
    expect(() => { (out as string[]).push('ws-injected'); }).toThrow();
  });

  test('two workspace grants do not collapse into the sentinel', () => {
    const out = permittedWorkspaces([ownerWs('u-1', 'ws-a'), ownerWs('u-1', 'ws-b')]);
    expect(out).not.toContain(PERMITTED_WORKSPACES_GLOBAL_SENTINEL);
    expect(out.length).toBe(2);
  });
});

// ── #4 Policy decisions: tampered/forged ──────────────────────────────

describe('integrity: policy engine denies tampered decisions', () => {
  test('forged roleId yields a deny with no-matching-scope', () => {
    const d = evaluate(
      [{ roleId: 'phantom-superuser', actorKind: 'user', actorId: 'u-1', scopeKind: 'workspace', scopeId: 'ws-1' }],
      'admin', { kind: 'workspace', id: 'ws-1' },
    );
    expect(d.allow).toBe(false);
    expect(d.reason).toBe('no-matching-scope');
  });

  test('workspace grant does not satisfy a different workspace id', () => {
    const d = evaluate([ownerWs('u-1', 'ws-a')], 'read', { kind: 'workspace', id: 'ws-b' });
    expect(d.allow).toBe(false);
  });

  test('viewer grant denies admin action', () => {
    const d = evaluate(
      [{ roleId: 'viewer', actorKind: 'user', actorId: 'u-1', scopeKind: 'workspace', scopeId: 'ws-1' }],
      'admin', { kind: 'workspace', id: 'ws-1' },
    );
    expect(d.allow).toBe(false);
  });
});

// ── RbacResolver owner-grant filter ───────────────────────────────────

describe('integrity: RbacResolver owner-grant filter is exact', () => {
  test('ownerGrantsForUser returns only owner roleId entries', async () => {
    const store = new InMemoryGrantStore([
      ownerWs('u-1', 'ws-a'),
      { roleId: 'editor', actorKind: 'user', actorId: 'u-1', scopeKind: 'workspace', scopeId: 'ws-b' },
    ]);
    const resolver = new RbacResolver(store);
    const owners = await resolver.ownerGrantsForUser('u-1');
    expect(owners.length).toBe(1);
    expect(owners[0]!.scopeId).toBe('ws-a');
  });

  test('revoke is idempotent and does not corrupt the index', async () => {
    const g = ownerWs('u-1', 'ws-a');
    const store = new InMemoryGrantStore([g]);
    expect(await store.revoke(g)).toBe(true);
    expect(await store.revoke(g)).toBe(false);
    expect((await store.grantsForUser('u-1')).length).toBe(0);
  });
});

// ── #6 Audit hash chain ───────────────────────────────────────────────

describe('integrity: audit-event hash chain rejects tampered records', () => {
  test('an untampered chain verifies', async () => {
    const s = new InMemoryAuditEventStore();
    await s.append({ actor: { type: 'user', id: 'u-1' }, eventType: 'login' });
    await s.append({ actor: { type: 'user', id: 'u-1' }, eventType: 'workspace.create', payload: { workspaceId: 'ws-1' } });
    expect(verifyAuditHashChain(await s.listRecords())).toBe(true);
  });

  test('mutating payloadJson breaks the chain', async () => {
    const s = new InMemoryAuditEventStore();
    await s.append({ actor: { type: 'user', id: 'u-1' }, eventType: 'login' });
    const [r] = await s.listRecords();
    const tampered: AuditEventRecord = { ...r!, payloadJson: JSON.stringify({ extra: 'injected' }) };
    expect(verifyAuditHashChain([tampered])).toBe(false);
  });

  test('mutating actor.id breaks the chain', async () => {
    const s = new InMemoryAuditEventStore();
    await s.append({ actor: { type: 'user', id: 'u-1' }, eventType: 'login' });
    const [r] = await s.listRecords();
    const tampered: AuditEventRecord = { ...r!, actor: { ...r!.actor, id: 'u-attacker' } };
    expect(verifyAuditHashChain([tampered])).toBe(false);
  });

  test('splicing out a middle record is detected', async () => {
    const s = new InMemoryAuditEventStore();
    await s.append({ actor: { type: 'user', id: 'u-1' }, eventType: 'a' });
    await s.append({ actor: { type: 'user', id: 'u-1' }, eventType: 'b' });
    await s.append({ actor: { type: 'user', id: 'u-1' }, eventType: 'c' });
    const r = await s.listRecords();
    expect(verifyAuditHashChain([r[0]!, r[2]!])).toBe(false);
  });

  test('reordering two records breaks the chain', async () => {
    const s = new InMemoryAuditEventStore();
    await s.append({ actor: { type: 'user', id: 'u-1' }, eventType: 'first' });
    await s.append({ actor: { type: 'user', id: 'u-1' }, eventType: 'second' });
    const r = await s.listRecords();
    expect(verifyAuditHashChain([r[1]!, r[0]!])).toBe(false);
  });

  test('swapping eventType while keeping the recorded hash is detected', async () => {
    const s = new InMemoryAuditEventStore();
    await s.append({ actor: { type: 'user', id: 'u-1' }, eventType: 'safe-action' });
    const [r] = await s.listRecords();
    const tampered: AuditEventRecord = { ...r!, eventType: 'admin.takeover' };
    expect(verifyAuditHashChain([tampered])).toBe(false);
  });

  test('an empty chain verifies (base case)', () => {
    expect(verifyAuditHashChain([])).toBe(true);
  });
});

// ── #7 Audit payload secret redaction ─────────────────────────────────

describe('integrity: audit-event payload sanitizes secrets', () => {
  test('sensitive keys are replaced with [redacted]', () => {
    const json = serializeAuditPayload({
      token: 'super-secret-token',
      apiKey: 'sk-real-key',
      password: 'hunter2',
      safe: 'visible',
    });
    expect(json).not.toContain('super-secret-token');
    expect(json).not.toContain('sk-real-key');
    expect(json).not.toContain('hunter2');
    expect(json).toContain('[redacted]');
    expect(json).toContain('visible');
  });

  test('bearer-token string patterns are scrubbed inside arbitrary values', () => {
    const json = serializeAuditPayload({ headers: 'Authorization: Bearer abc.def.ghi' });
    expect(json).not.toContain('abc.def.ghi');
    expect(json).toContain('[redacted]');
  });

  test('serializer is stable (deterministic key ordering)', () => {
    expect(serializeAuditPayload({ b: 1, a: 2, c: 3 }))
      .toBe(serializeAuditPayload({ c: 3, a: 2, b: 1 }));
  });

  test('appended record hash incorporates sanitized (not raw) payload', async () => {
    const s = new InMemoryAuditEventStore();
    const rec = await s.append({
      actor: { type: 'user', id: 'u-1' },
      eventType: 'oauth.complete',
      payload: { token: 'leaked-token-value' },
    });
    expect(rec.payloadJson).not.toContain('leaked-token-value');
    expect(rec.payloadJson).toContain('[redacted]');
    expect(verifyAuditHashChain([rec])).toBe(true);
  });
});
