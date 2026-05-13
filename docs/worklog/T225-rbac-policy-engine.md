# T225 - RBAC policy engine

## 1. Task summary

Land the pure-function RBAC policy evaluator. Consumes the role grant shape
from T224 and exposes `evaluate(grants, action, resource)` plus
`permittedWorkspaces(grants)`. No persistence, no RPC wiring.

## 2. Repo context discovered

- T224 added `roles-schema.ts` in the same directory, with the role and grant
  shapes the engine evaluates. The engine imports `RoleGrant`, `RbacAction`,
  and `ScopeKind` from there.
- The Phase 2 spec
  (`docs/superpowers/goals/2026-05-13-agent-workbench-suite-master-roadmap-goal.md`,
  Phase 2 §2) requires the engine to be pure (no I/O, exhaustively unit-tested)
  and to expose `permittedWorkspaces` as the contract for the
  `deriveScopeFromAuth` swap that T226 performs.
- `packages/server-core/src/handlers/rpc/account-ownership.ts` is the current
  "always permit" stub recorded by ADR `0007`. T225 leaves it untouched. T226
  is responsible for replacing the stub.
- `packages/server-core/src/accounts/AccountStore.ts` exposes
  `listWorkspaceIds(userId)` which `deriveScopeFromAuth` calls today. T225
  does not touch that file either.

## 3. Files inspected

- `AGENTS.md`
- `docs/superpowers/goals/2026-05-13-agent-workbench-suite-master-roadmap-goal.md`
- `docs/decision-records/audit-harness/0007-multi-tenant-storage-isolation.md`
- `packages/shared/src/auth/index.ts`
- `packages/shared/src/auth/roles-schema.ts`
- `packages/shared/src/auth/__tests__/types.test.ts`
- `packages/shared/package.json`
- `docs/tickets/T224-rbac-roles-schema.md`
- `docs/worklog/T224-rbac-roles-schema.md`

## 4. Tests added first

- `packages/shared/src/auth/__tests__/policy-engine.test.ts` covering:
  - Return shape: always `{allow, reason}`, never throws, `no-grant` reason
    for empty grants.
  - `owner` allows `read`, `write`, `admin`.
  - `editor` allows `read`, `write`; denies `admin`.
  - `viewer` allows `read`; denies `write`, `admin`.
  - Scope isolation: W1 grant does not cover W2 (and the deny reason is not
    `no-grant`).
  - Global-scope grants cover every workspace resource; the decision reason
    contains `'global'`.
  - Union of grants: combining viewer with editor across different scopes,
    and combining viewer with owner on the same scope, both behave correctly.
  - `permittedWorkspaces` returns `[]` for no grants, the deduplicated set of
    readable workspace ids, the `['*']` sentinel for any global-scope read,
    and ignores unknown role ids and org-scope grants.
  - Purity: same inputs → same outputs, frozen inputs are not mutated, no
    `process.env` reads (test deletes `NODE_ENV` and confirms the evaluator
    still works).

## 5. Expected failing test output

```
bun test v1.3.13 (bf2e2cec)

packages/shared/src/auth/__tests__/policy-engine.test.ts:

# Unhandled error between tests
-------------------------------
error: Cannot find module '../policy-engine' from
'/tmp/rox-m2-foundation/packages/shared/src/auth/__tests__/policy-engine.test.ts'
-------------------------------

 0 pass
 1 fail
 1 error
Ran 1 test across 1 file. [47.00ms]
```

## 6. Implementation changes

- Added `packages/shared/src/auth/policy-engine.ts` exporting:
  - `PolicyDecision` interface (`allow`, `reason`).
  - `PolicyResource` interface.
  - `PERMITTED_WORKSPACES_GLOBAL_SENTINEL` constant (`'*'`).
  - `evaluate(grants, action, resource)` — pure function, never throws.
  - `permittedWorkspaces(grants)` — returns a frozen, deduplicated array of
    readable workspace ids, or the global sentinel when any grant is a
    global-scope read.
- Implementation details:
  - `ROLE_ACTIONS` map encodes the `owner`/`editor`/`viewer` action sets and
    is frozen. Unknown role ids are treated as having no actions.
  - `grantCoversResource` handles global-scope grants as covering every
    resource and otherwise requires `scopeKind` and `scopeId` to match.
  - Decision reasons are `no-grant`, `no-matching-scope`, `global-<roleId>`,
    or `<scopeKind>-<roleId>` — machine-friendly and stable for logging and
    tests.
  - `permittedWorkspaces` skips org-scope grants and grants without `read`,
    and never returns a workspace id with an empty string.
- Wired the module into `packages/shared/src/auth/index.ts` and added the
  `./auth/policy-engine` subpath export to `packages/shared/package.json`.

## 7. Validation commands run

- `bun test packages/shared/src/auth/__tests__/policy-engine.test.ts`
- `bun test packages/shared/src/auth/__tests__/roles-schema.test.ts`
  (confirmed T224 still passes after the barrel edit)
- `bun run validate:rebrand`
- `git diff --check`

## 8. Passing test output summary

```
bun test v1.3.13 (bf2e2cec)

 27 pass
 0 fail
 39 expect() calls
Ran 27 tests across 1 file. [49.00ms]
```

T224 tests continue to pass (`14 pass`).

## 9. Build output summary

No build was run for T225. Like T224 this is a pure types-and-functions
addition with no runtime call sites yet. Build coverage lands with T226
when the engine is wired into `deriveScopeFromAuth`.

## 10. Remaining risks

- The engine does not yet understand user-defined roles. T227 (admin RPC)
  introduces persisted roles whose action sets must be looked up from
  storage rather than from the `ROLE_ACTIONS` constant.
- `permittedWorkspaces` uses the `'*'` sentinel for "all workspaces". Each
  consumer of this function must explicitly handle the sentinel; failure to
  do so would silently scope a global reader to zero workspaces. T226 is
  responsible for handling the sentinel in `deriveScopeFromAuth`.
- The engine's first-match semantics ("any allowing grant wins") is correct
  for additive policies but would be wrong if deny-rules are ever introduced.
  Deny-rules are out of scope for M.2.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| `evaluate` returns `{allow, reason}` and never throws | Green | Policy-engine test: `evaluate — return shape` describe block |
| System roles allow exactly the documented action sets | Green | Three describe blocks for owner/editor/viewer |
| Scope isolation enforced (W1 grant does not cover W2) | Green | `evaluate — scope isolation` describe block |
| Global-scope grants cover every resource scope | Green | `evaluate — global scope` describe block |
| Union of grants applies (any allowing grant wins) | Green | `evaluate — union of grants` describe block |
| `permittedWorkspaces` returns the right set / global sentinel | Green | `permittedWorkspaces` describe block |
| Pure: same inputs → same outputs, no mutation, no env reads | Green | `purity guarantees` describe block |
| Unit tests pass | Green | 27 pass, 0 fail |
| `validate:rebrand` exits 0 | Green | Validation log in Section 7 |
| `account-ownership.ts` and `AccountStore.ts` not modified | Green | `git diff --stat` shows zero edits to those files |
| Worklog complete | Green | All 11 sections present |
| Commit created | Green | T225 committed with Lore protocol |
