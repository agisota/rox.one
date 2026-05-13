# T244 worklog — reserve `'*'` as forbidden workspace `scopeId` at schema layer

## 1. Goal

Close T243 Finding A at the schema boundary. The runtime must not
be able to persist a `RoleGrant` whose `scopeId === '*'` for
workspace or org scope, because such a grant produces a
`permittedWorkspaces` output observationally identical to the
global-owner sentinel.

## 2. Approach

Add a pure, storage-agnostic `validateRoleGrant(grant)` function to
`packages/shared/src/auth/roles-schema.ts` that returns a
discriminated `Result` union. Plumb it through the
`InMemoryGrantStore` mutation boundary
(`constructor` seed + `grant()`) so smuggled grants are rejected
before persistence. Leave `revoke()` permissive so operators can
clean up legacy pre-T244 grants.

Tests:

- New `schema-reservation.test.ts` — 31 cases / 135 expect() calls
  covering every reject path, the happy-path matrix, and the
  grant-store enforcement boundary.
- Extended `scope-forgery.property.test.ts` — one new property,
  ≥2000 iterations total (1000 reject + 1000 accept) keyed off
  `T243_SEED ^ 0xb1ade244`.

## 3. Surface modified

- `packages/shared/src/auth/roles-schema.ts` — added
  `RESERVED_WORKSPACE_SENTINEL_ID`, `VALID_ACTOR_KINDS`,
  `VALID_SCOPE_KINDS`, `RoleGrantValidationCode`,
  `RoleGrantValidationError`, `RoleGrantValidationResult`,
  `validateRoleGrant`, `assertValidRoleGrant`. The `RoleGrant`
  interface is unchanged (additive only).
- `packages/shared/src/auth/rbac-resolver.ts` —
  `InMemoryGrantStore.constructor` and `InMemoryGrantStore.grant`
  call `assertValidRoleGrant`. `revoke()` left permissive.
- `packages/shared/src/auth/__tests__/schema-reservation.test.ts` —
  new test file.
- `packages/shared/src/auth/__tests__/scope-forgery.property.test.ts` —
  added Property 5 (validator-rejects + validator-accepts).

Files NOT modified:

- `packages/shared/src/auth/role-store.ts` — the `RoleStore`
  interface is about role definitions, not grants. T244 leaves it
  alone.
- `packages/shared/src/auth/policy-engine.ts` — left alone per the
  prompt's file allowlist; the validator runs upstream of the
  engine, not inside it.
- `packages/server-core/src/handlers/rpc/roles.ts` — outside the
  T244 file allowlist. The store-level throw already provides
  defence in depth; surfacing a clean `invalid-argument` reason at
  the RPC layer is T246's job.

## 4. Rejection rules implemented

| Code                    | Trigger                                                  |
| ----------------------- | -------------------------------------------------------- |
| `reserved-scope-id`     | `scopeId === '*'` on workspace/org                       |
| `empty-scope-id`        | `scopeId === ''` on workspace/org                        |
| `global-scope-with-id`  | `scopeKind === 'global'` with non-null `scopeId`         |
| `scoped-without-id`     | workspace/org with `scopeId === null`                    |
| `unknown-scope-kind`    | `scopeKind` not in {workspace, org, global}              |
| `unknown-actor-kind`    | `actorKind` not in {user, team}                          |
| `empty-role-id`         | `roleId === ''` or non-string                            |
| `empty-actor-id`        | `actorId === ''` or non-string                           |
| `non-string-scope-id`   | `scopeId` is neither a string nor `null` (e.g. number)   |

## 5. Results

```
$ bun test packages/shared/src/auth/__tests__/schema-reservation.test.ts
bun test v1.3.13 (bf2e2cec)

 31 pass
 0 fail
 135 expect() calls
Ran 31 tests across 1 file. [44 ms]
```

```
$ bun test packages/shared/src/auth/__tests__/scope-forgery.property.test.ts
bun test v1.3.13 (bf2e2cec)

 6 pass
 0 fail
 9347 expect() calls
Ran 6 tests across 1 file. [70 ms]
```

Full auth-package sweep: 198 / 206 pass. The 8 failures are
pre-existing on `main` (missing optional `tar` /
`@anthropic-ai/claude-agent-sdk` packages + a GitHub MCP E2E
network call that times out without credentials). Verified by
`git stash` + re-running on the unmodified working tree.

## 6. Findings

### Finding A (T243) — closed at the schema layer

Status: CLOSED at the persistence boundary. A grant with
`scopeKind === 'workspace' | 'org'` and `scopeId === '*'` is now
rejected by `validateRoleGrant` with code `'reserved-scope-id'`.
`InMemoryGrantStore.constructor` and `.grant()` both call
`assertValidRoleGrant`, so the runtime cannot persist a smuggled
grant.

The `permittedWorkspaces` output ambiguity itself (Property 3 in
T243) is unchanged — the pure function still emits `['*']` if fed
a smuggled grant directly in tests. The fix is at the gate, not at
the engine: smuggled grants never reach the engine because the
store rejects them.

### Finding B (T244) — `revoke()` left permissive

Deliberate. Operators may have legacy grants persisted before T244
landed (e.g. test fixtures, hand-crafted JSON). `revoke()` does not
validate, so those grants can be cleaned up via the normal API
without a migration script.

## 7. Deviations from the prompt

- The prompt mentions extending `RoleStore` / `GrantStore` mutation
  paths. The grant validator is now on the `GrantStore`
  implementation (`InMemoryGrantStore`). `RoleStore` already
  rejects empty / system-colliding role ids — adding grant
  validation to it would mix concerns. The validator import is
  documented in the `GrantStore` JSDoc as an implementation
  requirement.
- LOC budgets:
  - source delta: `roles-schema.ts` +202, `rbac-resolver.ts` +24,
    total +226 LOC (target ≤250 ✓).
  - new test file: 330 LOC (target ≤350 ✓).
  - property test delta: +57 LOC (consolidated to one Property 5).

## 8. Validation matrix

| Gate                                     | Result                                  |
| ---------------------------------------- | --------------------------------------- |
| `bun test schema-reservation.test.ts`    | 31 / 31, 135 expect() calls, 44 ms      |
| `bun test scope-forgery.property…`       | 6 / 6, 9347 expect() calls, 70 ms       |
| `bun test packages/shared/src/auth/__tests__/` | 198 / 206 (8 pre-existing main fails) |
| `bun run validate:rebrand`               | pass                                    |
| `bun run validate:agent-contract`        | pass                                    |
| `bun run validate:roadmap`               | pass                                    |

## 9. Files touched

| Path                                                                            | Status   |
| ------------------------------------------------------------------------------- | -------- |
| `packages/shared/src/auth/roles-schema.ts`                                      | modified |
| `packages/shared/src/auth/rbac-resolver.ts`                                     | modified |
| `packages/shared/src/auth/__tests__/schema-reservation.test.ts`                 | new      |
| `packages/shared/src/auth/__tests__/scope-forgery.property.test.ts`             | modified |
| `docs/tickets/T244-schema-reservation-asterisk.md`                              | new      |
| `docs/worklog/T244-schema-reservation-asterisk.md`                              | new      |

## 10. Follow-ups

- **T246** — plumb `validateRoleGrant` into the RPC handler so
  `roles.grant` returns a clean
  `{ error: 'invalid-argument', reason: 'reserved-scope-id' }`
  instead of a 500 from the store-level throw.
- **M.14** — verify any future Postgres-backed `GrantStore` imports
  `assertValidRoleGrant` at the same boundary.

## 11. Closeout

- T243 Finding A is closed at the persistence boundary.
- All validation gates pass locally.
- Two atomic commits delivered: `feat(rbac)` for the schema +
  resolver change, `docs(tickets)` for the ticket + worklog.
- PR opened against `main` with the threat-model summary and the
  T245/T246 follow-ups.
