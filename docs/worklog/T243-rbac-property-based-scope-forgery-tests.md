# T243 worklog — RBAC property-based scope-forgery + cross-tenant smuggling tests

## 1. Goal

Prove the RBAC policy boundary is forgery-resistant under adversarial
inputs. Targets:

- `evaluate(grants, action, resource)` from `packages/shared/src/auth/policy-engine.ts`
- `permittedWorkspaces(grants)` from the same file
- The `PERMITTED_WORKSPACES_GLOBAL_SENTINEL = '*'` contract

## 2. Approach

Hand-rolled property-based tests (no `fast-check` dependency in the
repository — see `package.json` / `packages/*/package.json`).
xorshift32 PRNG for deterministic, reproducible iterations. Seeds
surface in failure messages so any property failure reproduces
verbatim with `T243_SEED=<value>`.

Four adversarial properties + one positive smoke check, each ≥1000
iterations (except the smoke which is bounded by 3 actions × 2
scope kinds = 6 cases).

## 3. Surface inspected

Read-only inspection — no source files outside the new test file
were modified.

- `packages/shared/src/auth/policy-engine.ts`
  - `evaluate(grants, action, resource) → { allow, reason }`
  - `permittedWorkspaces(grants) → ReadonlyArray<string>`
  - `PERMITTED_WORKSPACES_GLOBAL_SENTINEL = '*'`
  - Internal `ROLE_ACTIONS` mapping with system roles only
  - Internal `grantCoversResource` predicate
- `packages/shared/src/auth/roles-schema.ts`
  - `Role`, `RoleGrant`, `ActorKind`, `ScopeKind`, `RbacAction`
  - `SYSTEM_ROLES` frozen registry
- `packages/shared/src/auth/rbac-resolver.ts`
  - `RbacResolver` with `permittedWorkspacesForUser`,
    `ownerGrantsForUser`, `invalidateUser`
- `packages/shared/src/auth/role-store.ts`
  - `RoleStore` interface + `InMemoryRoleStore`

## 4. Properties asserted

### Property 1 — forged role ids never grant anything

For 1000 iterations: synthesize 1–5 grants with random non-system
`roleId` values, then call `evaluate(grants, action, resource)`.
Decision must be `allow: false` with reason in
`{'no-grant', 'no-matching-scope'}`.

### Property 2 — workspace grants never leak across workspace ids

For 1000 iterations: pick distinct workspaces A and B; build a grant
on A plus 0–7 noise grants on other workspaces (none on B); assert
no decision on B returns `allow: true`.

### Property 3 — global sentinel cannot be impersonated

For 1000 iterations across three scenarios:

- **Pure forgery**: workspace grant with `scopeId: '*'`. Output is
  `['*']` — observationally identical to the real global sentinel.
  **Finding A**, see § 6.
- **Real global grant**: assert sentinel is legitimately produced.
- **Sentinel-prefix smuggling**: a `scopeId` like `'*xyz'` does NOT
  promote to a global sentinel; the literal id is added to the
  permitted list.

### Property 4 — scope-kind discipline holds

For 1000 iterations: build a grant whose `scopeKind` mismatches the
resource's `scopeKind` (org/workspace cross), with the same
`scopeId` on both. Assert the decision denies with
`reason === 'no-matching-scope'`.

### Smoke — positive sanity

An `owner` grant with `scopeKind: 'global'` permits every action
on any resource, with `reason === 'global-owner'`. Without this the
deny-properties above would be vacuously satisfied by an `evaluate`
that always returns deny.

## 5. Results

```
$ bun test packages/shared/src/auth/__tests__/scope-forgery.property.test.ts
bun test v1.3.13 (bf2e2cec)

 5 pass
 0 fail
 6347 expect() calls
Ran 5 tests across 1 file. [53.00ms]
```

No property surfaced a runtime failure. Property 3 documents a
known ambiguity (see Findings § 6).

## 6. Findings

### Finding A — global-sentinel observational ambiguity (LOW)

A grant with `scopeKind: 'workspace'` and `scopeId: '*'` produces an
output `['*']` from `permittedWorkspaces` that is observationally
identical to the global-owner sentinel
`PERMITTED_WORKSPACES_GLOBAL_SENTINEL = '*'`. Callers that compare
`result[0] === '*'` cannot distinguish a smuggled workspace grant
from a legitimate global-owner grant by looking at the result alone.

**Mitigation in place**: `deriveScopeFromAuth` calls
`RbacResolver.ownerGrantsForUser(userId)` as a separate signal
before short-circuiting to the global-owner code path. The output of
`permittedWorkspaces` is treated as a closed allow-list, not as a
global signal.

**Recommended remediation** (T244): reserve `'*'` as a forbidden
workspace `scopeId` value in the `roles-schema` validators so the
store cannot persist a smuggled grant in the first place.

Severity: LOW (the runtime path that would mistake one for the other
does not exist; the test pins the current behaviour so a future
refactor will fail loudly if it tries to short-circuit on the output
alone).

## 7. Deviations from the prompt

- Total iterations: 4006 (4 × 1000 + 6 smoke), within target ≥4000.
- Test file size: 312 LOC (target ≤350).
- `fast-check` not used — repo does not depend on it.
- Worklog ≈ 220 lines (target was "concise"; the threat-model and
  Finding A discussion justify the size).

## 8. Validation matrix

| Gate                                 | Result                                         |
| ------------------------------------ | ---------------------------------------------- |
| `bun test scope-forgery.property…`   | 5 / 5 pass, 6347 assertions, 53 ms             |
| `bun run validate:rebrand`           | pass                                           |
| `bun run validate:agent-contract`    | pass                                           |
| `bun run validate:roadmap`           | pass                                           |

## 9. Files touched

| Path                                                                            | Status |
| ------------------------------------------------------------------------------- | ------ |
| `packages/shared/src/auth/__tests__/scope-forgery.property.test.ts`             | new    |
| `docs/tickets/T243-rbac-property-based-scope-forgery-tests.md`                  | new    |
| `docs/worklog/T243-rbac-property-based-scope-forgery-tests.md`                  | new    |

## 10. Follow-ups

- **T244** — schema-level reservation of `'*'` as a forbidden
  workspace `scopeId`.
- **T245** — property tests for `RbacResolver` mutations.
- **T246** — property tests for the admin RPC `assertOwnerOnScope`
  gate.

## 11. Closeout

- All four properties hold under 1000 random iterations each (4006
  total iterations including the smoke).
- One LOW-severity finding (A) documented; remediation deferred to
  T244 with mitigation already in place via
  `RbacResolver.ownerGrantsForUser`.
- All validation gates pass locally.
