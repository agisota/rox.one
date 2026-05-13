import { describe, it, expect } from 'bun:test';
import { InMemoryRoleStore, type RoleStore } from '../role-store';
import { SYSTEM_ROLES, type Role } from '../roles-schema';

describe('InMemoryRoleStore — defaults', () => {
  it('returns SYSTEM_ROLES from list() when no custom roles have been added', async () => {
    const store: RoleStore = new InMemoryRoleStore();
    const result = await store.list();
    expect(result.map((r) => r.id).sort()).toEqual(
      [...SYSTEM_ROLES].map((r) => r.id).sort(),
    );
  });

  it('exposes all SYSTEM_ROLES with their flags preserved', async () => {
    const store = new InMemoryRoleStore();
    const result = await store.list();
    for (const sys of SYSTEM_ROLES) {
      const found = result.find((r) => r.id === sys.id);
      expect(found).toBeDefined();
      expect(found!.systemManaged).toBe(true);
    }
  });
});

describe('InMemoryRoleStore — custom roles', () => {
  it('adds a custom role and includes it in list()', async () => {
    const store = new InMemoryRoleStore();
    const role: Role = {
      id: 'reviewer',
      name: 'Reviewer',
      description: 'Can read and comment',
      systemManaged: false,
    };
    await store.create(role);
    const result = await store.list();
    const ids = result.map((r) => r.id).sort();
    expect(ids).toEqual(['editor', 'owner', 'reviewer', 'viewer']);
  });

  it('preserves the custom role fields verbatim', async () => {
    const store = new InMemoryRoleStore();
    const role: Role = {
      id: 'auditor',
      name: 'Auditor',
      systemManaged: false,
    };
    await store.create(role);
    const result = await store.list();
    const found = result.find((r) => r.id === 'auditor');
    expect(found).toEqual(role);
  });
});

describe('InMemoryRoleStore — system role protection', () => {
  it('rejects creating a custom role whose id collides with a system role', async () => {
    const store = new InMemoryRoleStore();
    await expect(
      store.create({ id: 'owner', name: 'Custom Owner', systemManaged: false }),
    ).rejects.toThrow(/owner/);
  });

  it('rejects all three system role ids', async () => {
    const store = new InMemoryRoleStore();
    for (const sys of SYSTEM_ROLES) {
      await expect(
        store.create({ id: sys.id, name: 'Custom', systemManaged: false }),
      ).rejects.toThrow();
    }
  });

  it('rejects an empty role id', async () => {
    const store = new InMemoryRoleStore();
    await expect(
      store.create({ id: '', name: 'Empty', systemManaged: false }),
    ).rejects.toThrow();
  });
});

describe('InMemoryRoleStore — multiple custom roles', () => {
  it('preserves all created custom roles', async () => {
    const store = new InMemoryRoleStore();
    await store.create({ id: 'r1', name: 'R1', systemManaged: false });
    await store.create({ id: 'r2', name: 'R2', systemManaged: false });
    const result = await store.list();
    const customIds = result.filter((r) => !r.systemManaged).map((r) => r.id).sort();
    expect(customIds).toEqual(['r1', 'r2']);
  });
});
