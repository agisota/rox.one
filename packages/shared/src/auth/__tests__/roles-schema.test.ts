import { describe, it, expect } from 'bun:test';
import {
  SYSTEM_ROLES,
  isSystemRole,
  type Role,
  type RoleGrant,
  type ActorKind,
  type ScopeKind,
  type RbacAction,
} from '../roles-schema';

describe('Role type shape', () => {
  it('accepts an object with id, name, description, and systemManaged fields', () => {
    const role: Role = {
      id: 'role-id',
      name: 'Role Name',
      description: 'Role description',
      systemManaged: false,
    };
    expect(role.id).toBe('role-id');
    expect(role.name).toBe('Role Name');
    expect(role.description).toBe('Role description');
    expect(role.systemManaged).toBe(false);
  });

  it('allows description to be omitted (undefined)', () => {
    const role: Role = {
      id: 'role-id',
      name: 'Role Name',
      systemManaged: true,
    };
    expect(role.description).toBeUndefined();
  });
});

describe('RoleGrant type shape', () => {
  it('accepts a workspace-scoped user grant', () => {
    const grant: RoleGrant = {
      roleId: 'editor',
      actorKind: 'user',
      actorId: 'user-123',
      scopeKind: 'workspace',
      scopeId: 'workspace-1',
    };
    expect(grant.roleId).toBe('editor');
    expect(grant.actorKind).toBe('user');
    expect(grant.actorId).toBe('user-123');
    expect(grant.scopeKind).toBe('workspace');
    expect(grant.scopeId).toBe('workspace-1');
  });

  it('accepts an org-scoped team grant', () => {
    const grant: RoleGrant = {
      roleId: 'viewer',
      actorKind: 'team',
      actorId: 'team-7',
      scopeKind: 'org',
      scopeId: 'org-1',
    };
    expect(grant.actorKind).toBe('team');
    expect(grant.scopeKind).toBe('org');
  });

  it('accepts a global-scope grant with null scopeId', () => {
    const grant: RoleGrant = {
      roleId: 'owner',
      actorKind: 'user',
      actorId: 'user-root',
      scopeKind: 'global',
      scopeId: null,
    };
    expect(grant.scopeKind).toBe('global');
    expect(grant.scopeId).toBeNull();
  });

  it('exposes ActorKind, ScopeKind, and RbacAction unions', () => {
    const actorKinds: ActorKind[] = ['user', 'team'];
    const scopeKinds: ScopeKind[] = ['workspace', 'org', 'global'];
    const actions: RbacAction[] = ['read', 'write', 'admin'];
    expect(actorKinds).toHaveLength(2);
    expect(scopeKinds).toHaveLength(3);
    expect(actions).toHaveLength(3);
  });
});

describe('SYSTEM_ROLES constant', () => {
  it('contains exactly three entries', () => {
    expect(SYSTEM_ROLES).toHaveLength(3);
  });

  it('contains owner, editor, and viewer roles by id', () => {
    const ids = SYSTEM_ROLES.map((role) => role.id).sort();
    expect(ids).toEqual(['editor', 'owner', 'viewer']);
  });

  it('marks every entry as systemManaged: true', () => {
    for (const role of SYSTEM_ROLES) {
      expect(role.systemManaged).toBe(true);
    }
  });

  it('is frozen so callers cannot mutate the registry', () => {
    expect(Object.isFrozen(SYSTEM_ROLES)).toBe(true);
  });
});

describe('isSystemRole helper', () => {
  it('returns true for each of the three system role ids', () => {
    for (const role of SYSTEM_ROLES) {
      expect(isSystemRole(role)).toBe(true);
    }
  });

  it('returns true when called with a fresh object that shares an id with a system role', () => {
    const matching: Role = { id: 'owner', name: 'Custom Owner Copy', systemManaged: false };
    expect(isSystemRole(matching)).toBe(true);
  });

  it('returns false for a user-defined role id', () => {
    const custom: Role = { id: 'reviewer', name: 'Reviewer', systemManaged: false };
    expect(isSystemRole(custom)).toBe(false);
  });

  it('returns false for an empty role id', () => {
    const empty: Role = { id: '', name: '', systemManaged: false };
    expect(isSystemRole(empty)).toBe(false);
  });
});
