import { describe, it, expect } from 'bun:test';
import {
  InMemoryGrantStore,
  RbacResolver,
  type GrantStore,
} from '../rbac-resolver';
import { PERMITTED_WORKSPACES_GLOBAL_SENTINEL } from '../policy-engine';
import type { RoleGrant } from '../roles-schema';

const userGrant = (
  actorId: string,
  scopeKind: 'workspace' | 'org' | 'global',
  scopeId: string | null,
  roleId: string,
): RoleGrant => ({
  roleId,
  actorKind: 'user',
  actorId,
  scopeKind,
  scopeId,
});

describe('RbacResolver — empty grant store', () => {
  it('returns [] when the store has no grants for the user', async () => {
    const resolver = new RbacResolver(new InMemoryGrantStore());
    const result = await resolver.permittedWorkspacesForUser('u1');
    expect(result).toEqual([]);
  });
});

describe('RbacResolver — single workspace grant', () => {
  it('returns the single workspace scope id when the user has a workspace viewer grant', async () => {
    const grants: RoleGrant[] = [userGrant('u1', 'workspace', 'W1', 'viewer')];
    const resolver = new RbacResolver(new InMemoryGrantStore(grants));
    const result = await resolver.permittedWorkspacesForUser('u1');
    expect(result).toEqual(['W1']);
  });
});

describe('RbacResolver — global grant', () => {
  it('returns the global sentinel when the user has a global-scope owner grant', async () => {
    const grants: RoleGrant[] = [userGrant('u1', 'global', null, 'owner')];
    const resolver = new RbacResolver(new InMemoryGrantStore(grants));
    const result = await resolver.permittedWorkspacesForUser('u1');
    expect(result).toEqual([PERMITTED_WORKSPACES_GLOBAL_SENTINEL]);
  });
});

describe('RbacResolver — user isolation', () => {
  it('does not return grants belonging to a different user', async () => {
    const grants: RoleGrant[] = [
      userGrant('u1', 'workspace', 'W1', 'editor'),
      userGrant('u1', 'workspace', 'W2', 'viewer'),
    ];
    const resolver = new RbacResolver(new InMemoryGrantStore(grants));
    const result = await resolver.permittedWorkspacesForUser('u2');
    expect(result).toEqual([]);
  });

  it('returns u1 grants without leaking u2 grants', async () => {
    const grants: RoleGrant[] = [
      userGrant('u1', 'workspace', 'W1', 'viewer'),
      userGrant('u2', 'workspace', 'W2', 'viewer'),
    ];
    const resolver = new RbacResolver(new InMemoryGrantStore(grants));
    expect(await resolver.permittedWorkspacesForUser('u1')).toEqual(['W1']);
    expect(await resolver.permittedWorkspacesForUser('u2')).toEqual(['W2']);
  });
});

describe('RbacResolver — multiple workspace grants', () => {
  it('returns the deduplicated union of all workspace scope ids', async () => {
    const grants: RoleGrant[] = [
      userGrant('u1', 'workspace', 'W1', 'viewer'),
      userGrant('u1', 'workspace', 'W2', 'editor'),
      userGrant('u1', 'workspace', 'W3', 'owner'),
    ];
    const resolver = new RbacResolver(new InMemoryGrantStore(grants));
    const result = [...(await resolver.permittedWorkspacesForUser('u1'))].sort();
    expect(result).toEqual(['W1', 'W2', 'W3']);
  });

  it('deduplicates when the same workspace is granted through multiple roles', async () => {
    const grants: RoleGrant[] = [
      userGrant('u1', 'workspace', 'W1', 'viewer'),
      userGrant('u1', 'workspace', 'W1', 'editor'),
    ];
    const resolver = new RbacResolver(new InMemoryGrantStore(grants));
    const result = await resolver.permittedWorkspacesForUser('u1');
    expect(result).toEqual(['W1']);
  });
});

describe('InMemoryGrantStore — actor filtering', () => {
  it('ignores team-actor grants (RBAC for teams is out of scope for T226)', async () => {
    const grants: RoleGrant[] = [
      { roleId: 'viewer', actorKind: 'team', actorId: 'team-1', scopeKind: 'workspace', scopeId: 'W1' },
    ];
    const store = new InMemoryGrantStore(grants);
    expect(await store.grantsForUser('team-1')).toEqual([]);
  });

  it('returns an empty array for users with no seeded grants', async () => {
    const store = new InMemoryGrantStore([userGrant('u1', 'workspace', 'W1', 'viewer')]);
    expect(await store.grantsForUser('unknown-user')).toEqual([]);
  });
});

describe('RbacResolver — pluggable GrantStore', () => {
  it('uses a caller-provided async GrantStore implementation', async () => {
    const fake: GrantStore = {
      async grantsForUser(userId) {
        if (userId === 'u1') {
          return [userGrant('u1', 'workspace', 'W7', 'editor')];
        }
        return [];
      },
    };
    const resolver = new RbacResolver(fake);
    expect(await resolver.permittedWorkspacesForUser('u1')).toEqual(['W7']);
    expect(await resolver.permittedWorkspacesForUser('u2')).toEqual([]);
  });
});
