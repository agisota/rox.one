import { describe, it, expect } from 'bun:test';
import {
  evaluate,
  permittedWorkspaces,
  PERMITTED_WORKSPACES_GLOBAL_SENTINEL,
  type PolicyDecision,
  type PolicyResource,
} from '../policy-engine';
import type { RoleGrant } from '../roles-schema';

const workspaceResource = (scopeId: string): PolicyResource => ({
  scopeKind: 'workspace',
  scopeId,
});

const grantOf = (
  roleId: string,
  scopeKind: 'workspace' | 'org' | 'global',
  scopeId: string | null,
): RoleGrant => ({
  roleId,
  actorKind: 'user',
  actorId: 'user-1',
  scopeKind,
  scopeId,
});

describe('evaluate — return shape', () => {
  it('always returns a PolicyDecision object with allow and reason', () => {
    const decision: PolicyDecision = evaluate([], 'read', workspaceResource('W1'));
    expect(decision).toHaveProperty('allow');
    expect(decision).toHaveProperty('reason');
    expect(typeof decision.allow).toBe('boolean');
    expect(typeof decision.reason).toBe('string');
  });

  it('never throws — returns deny for empty grants array', () => {
    expect(() => evaluate([], 'admin', workspaceResource('W1'))).not.toThrow();
  });

  it('returns deny with reason "no-grant" when the actor has no grants', () => {
    const decision = evaluate([], 'read', workspaceResource('W1'));
    expect(decision.allow).toBe(false);
    expect(decision.reason).toBe('no-grant');
  });
});

describe('evaluate — owner role', () => {
  const owner = [grantOf('owner', 'workspace', 'W1')];

  it('grants read on the scoped workspace', () => {
    expect(evaluate(owner, 'read', workspaceResource('W1')).allow).toBe(true);
  });

  it('grants write on the scoped workspace', () => {
    expect(evaluate(owner, 'write', workspaceResource('W1')).allow).toBe(true);
  });

  it('grants admin on the scoped workspace', () => {
    expect(evaluate(owner, 'admin', workspaceResource('W1')).allow).toBe(true);
  });
});

describe('evaluate — editor role', () => {
  const editor = [grantOf('editor', 'workspace', 'W1')];

  it('grants read on the scoped workspace', () => {
    expect(evaluate(editor, 'read', workspaceResource('W1')).allow).toBe(true);
  });

  it('grants write on the scoped workspace', () => {
    expect(evaluate(editor, 'write', workspaceResource('W1')).allow).toBe(true);
  });

  it('denies admin on the scoped workspace', () => {
    const decision = evaluate(editor, 'admin', workspaceResource('W1'));
    expect(decision.allow).toBe(false);
  });
});

describe('evaluate — viewer role', () => {
  const viewer = [grantOf('viewer', 'workspace', 'W1')];

  it('grants read on the scoped workspace', () => {
    expect(evaluate(viewer, 'read', workspaceResource('W1')).allow).toBe(true);
  });

  it('denies write on the scoped workspace', () => {
    expect(evaluate(viewer, 'write', workspaceResource('W1')).allow).toBe(false);
  });

  it('denies admin on the scoped workspace', () => {
    expect(evaluate(viewer, 'admin', workspaceResource('W1')).allow).toBe(false);
  });
});

describe('evaluate — scope isolation', () => {
  it('denies access to a workspace not covered by the grant', () => {
    const grants = [grantOf('owner', 'workspace', 'W1')];
    const decision = evaluate(grants, 'read', workspaceResource('W2'));
    expect(decision.allow).toBe(false);
    expect(decision.reason).not.toBe('no-grant');
  });

  it('denies access when scopeKind matches but scopeId differs', () => {
    const grants = [grantOf('editor', 'workspace', 'W1')];
    expect(evaluate(grants, 'write', workspaceResource('W3')).allow).toBe(false);
  });
});

describe('evaluate — global scope', () => {
  it('grants access to any workspace when role is globally scoped', () => {
    const grants = [grantOf('owner', 'global', null)];
    expect(evaluate(grants, 'admin', workspaceResource('any-workspace')).allow).toBe(true);
    expect(evaluate(grants, 'write', workspaceResource('another')).allow).toBe(true);
    expect(evaluate(grants, 'read', workspaceResource('third')).allow).toBe(true);
  });

  it('encodes the global scope in the decision reason', () => {
    const grants = [grantOf('editor', 'global', null)];
    const decision = evaluate(grants, 'read', workspaceResource('W1'));
    expect(decision.allow).toBe(true);
    expect(decision.reason).toContain('global');
  });
});

describe('evaluate — union of grants', () => {
  it('allows when any grant permits the action (viewer + editor on different scopes)', () => {
    const grants = [
      grantOf('viewer', 'workspace', 'W1'),
      grantOf('editor', 'workspace', 'W2'),
    ];
    expect(evaluate(grants, 'read', workspaceResource('W1')).allow).toBe(true);
    expect(evaluate(grants, 'write', workspaceResource('W1')).allow).toBe(false);
    expect(evaluate(grants, 'write', workspaceResource('W2')).allow).toBe(true);
  });

  it('allows admin when one grant is owner and another is viewer on the same workspace', () => {
    const grants = [
      grantOf('viewer', 'workspace', 'W1'),
      grantOf('owner', 'workspace', 'W1'),
    ];
    expect(evaluate(grants, 'admin', workspaceResource('W1')).allow).toBe(true);
  });
});

describe('permittedWorkspaces', () => {
  it('returns an empty array when there are no grants', () => {
    expect(permittedWorkspaces([])).toEqual([]);
  });

  it('returns the set of workspace ids the user can read', () => {
    const grants = [
      grantOf('viewer', 'workspace', 'W1'),
      grantOf('editor', 'workspace', 'W2'),
    ];
    const result = [...permittedWorkspaces(grants)].sort();
    expect(result).toEqual(['W1', 'W2']);
  });

  it('returns the global sentinel when any grant has global scope with read access', () => {
    const grants = [grantOf('viewer', 'global', null)];
    expect(permittedWorkspaces(grants)).toEqual([PERMITTED_WORKSPACES_GLOBAL_SENTINEL]);
  });

  it('omits grants without read access (no role match)', () => {
    const grants: RoleGrant[] = [
      { roleId: 'no-such-role', actorKind: 'user', actorId: 'u', scopeKind: 'workspace', scopeId: 'W9' },
    ];
    expect(permittedWorkspaces(grants)).toEqual([]);
  });

  it('omits non-workspace scope ids from the returned array (org grants are dropped without global sentinel)', () => {
    const grants = [grantOf('owner', 'org', 'org-1')];
    expect(permittedWorkspaces(grants)).toEqual([]);
  });

  it('deduplicates workspace ids when multiple grants target the same workspace', () => {
    const grants = [
      grantOf('viewer', 'workspace', 'W1'),
      grantOf('editor', 'workspace', 'W1'),
      grantOf('owner', 'workspace', 'W1'),
    ];
    expect(permittedWorkspaces(grants)).toEqual(['W1']);
  });
});

describe('purity guarantees', () => {
  it('returns the same decision for the same inputs (no hidden state)', () => {
    const grants = [grantOf('editor', 'workspace', 'W1')];
    const a = evaluate(grants, 'write', workspaceResource('W1'));
    const b = evaluate(grants, 'write', workspaceResource('W1'));
    expect(a).toEqual(b);
  });

  it('does not mutate the grants array', () => {
    const grants: ReadonlyArray<RoleGrant> = Object.freeze([
      grantOf('viewer', 'workspace', 'W1'),
    ]);
    expect(() => evaluate(grants, 'read', workspaceResource('W1'))).not.toThrow();
    expect(() => permittedWorkspaces(grants)).not.toThrow();
    expect(grants).toHaveLength(1);
  });

  it('does not read process.env (evaluated under sterile env)', () => {
    const before = process.env.NODE_ENV;
    delete process.env.NODE_ENV;
    try {
      const grants = [grantOf('owner', 'workspace', 'W1')];
      const decision = evaluate(grants, 'admin', workspaceResource('W1'));
      expect(decision.allow).toBe(true);
    } finally {
      if (before !== undefined) process.env.NODE_ENV = before;
    }
  });
});
