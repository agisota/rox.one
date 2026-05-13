# T224 - RBAC roles schema

## 1. Task summary

Land the TypeScript types and the system-managed role registry that the M.2
RBAC slice builds on. Types only — no persistence, no RPC, no UI.

## 2. Repo context discovered

- `packages/shared/src/auth/` already exists and houses the OAuth-related
  modules. Adding the RBAC schema next to OAuth keeps all auth primitives in
  one package and one barrel.
- `packages/shared/src/auth/index.ts` re-exports each module via
  `export * from './<file>.ts'`. The same pattern is used here.
- `packages/shared/package.json` already exposes the `./auth` subpath; an
  additional `./auth/roles-schema` entry was added so external consumers can
  target the new module directly when they need to avoid pulling the OAuth
  surface.
- The Phase 2 spec
  (`docs/superpowers/goals/2026-05-13-agent-workbench-suite-master-roadmap-goal.md`)
  specifies the role × action matrix and the three system roles `owner`,
  `editor`, `viewer`. The action set is `read`, `write`, `admin`.
- ADR `0007-multi-tenant-storage-isolation` records `session.permittedWorkspaces`
  as the contract field that the RBAC slice produces. T224 does not yet wire
  the schema into that field; that lands in T226.

## 3. Files inspected

- `AGENTS.md`
- `docs/superpowers/goals/2026-05-13-agent-workbench-suite-master-roadmap-goal.md`
- `docs/decision-records/audit-harness/0007-multi-tenant-storage-isolation.md`
- `packages/shared/src/auth/index.ts`
- `packages/shared/src/auth/types.ts`
- `packages/shared/src/auth/__tests__/types.test.ts`
- `packages/shared/package.json`
- `docs/tickets/TEMPLATE.md`
- `docs/tickets/T223-c4-followups-closeout.md`
- `docs/worklog/T223-c4-followups-closeout.md`

## 4. Tests added first

- `packages/shared/src/auth/__tests__/roles-schema.test.ts` covering:
  - `Role` type shape (id, name, optional description, systemManaged).
  - `RoleGrant` type shape for workspace, org, and global grants.
  - `SYSTEM_ROLES` constant: exactly three entries with ids `owner`, `editor`,
    `viewer`, every entry `systemManaged: true`, and `Object.isFrozen` true.
  - `isSystemRole` returns true for system role ids (including a fresh object
    that shares an id), false for arbitrary user-defined ids and the empty id.

## 5. Expected failing test output

```
bun test v1.3.13 (bf2e2cec)

packages/shared/src/auth/__tests__/roles-schema.test.ts:

# Unhandled error between tests
-------------------------------
error: Cannot find module '../roles-schema' from
'/tmp/rox-m2-foundation/packages/shared/src/auth/__tests__/roles-schema.test.ts'
-------------------------------

 0 pass
 1 fail
 1 error
Ran 1 test across 1 file. [48.00ms]
```

## 6. Implementation changes

- Added `packages/shared/src/auth/roles-schema.ts` exporting:
  - `Role` interface (`id`, `name`, optional `description`, `systemManaged`).
  - `ActorKind`, `ScopeKind`, `RbacAction` union types.
  - `RoleGrant` interface.
  - `SYSTEM_ROLES` frozen array of three frozen entries.
  - `isSystemRole(role)` helper that rejects empty ids.
- Wired the new module into `packages/shared/src/auth/index.ts` via
  `export * from './roles-schema.ts'`.
- Added `./auth/roles-schema` subpath export to `packages/shared/package.json`.

## 7. Validation commands run

- `bun test packages/shared/src/auth/__tests__/roles-schema.test.ts`
- `bun run validate:rebrand`
- `git diff --check`

## 8. Passing test output summary

```
bun test v1.3.13 (bf2e2cec)

 14 pass
 0 fail
 29 expect() calls
Ran 14 tests across 1 file. [51.00ms]
```

## 9. Build output summary

No build was run for T224. The slice is types-only inside an existing package;
the only consumers are the colocated test file and (in the next ticket) the
policy engine in the same directory. Phase-level build coverage runs once
T226 wires the new schema into runtime call sites.

## 10. Remaining risks

- The schema is not yet persisted. A later persistence ticket (T226 or later)
  must define the storage shape, migration, and validation rules.
- User-defined roles are not yet recognized by the policy engine; T225 treats
  unknown role ids as "no actions" by design.
- The schema does not encode role hierarchies (e.g. owner ⊃ editor ⊃ viewer)
  beyond the action set in T225. That semantics is enforced by the engine, not
  the schema, which is the deliberate split.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| `Role`, `RoleGrant`, supporting unions exported with documented fields | Green | `packages/shared/src/auth/roles-schema.ts` |
| `SYSTEM_ROLES` has exactly three entries (`owner`, `editor`, `viewer`) | Green | Roles-schema test: `it('contains exactly three entries')` |
| Every `SYSTEM_ROLES` entry has `systemManaged: true` | Green | Roles-schema test: `it('marks every entry as systemManaged: true')` |
| `isSystemRole` returns true for system ids, false for user ids | Green | Roles-schema test: `isSystemRole helper` describe block |
| Unit tests pass | Green | 14 pass, 0 fail |
| `validate:rebrand` exits 0 | Green | Validation log in Section 7 |
| `account-ownership.ts` and `AccountStore.ts` not modified | Green | `git diff --stat` shows zero edits to those files |
| Worklog complete | Green | All 11 sections present |
| Commit created | Green | T224 committed with Lore protocol |
