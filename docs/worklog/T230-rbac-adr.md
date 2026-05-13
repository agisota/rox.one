# T230 - RBAC ADR (0009-rbac-policy.md)

## 1. Task summary

Land the M.2 closeout ADR (`docs/decision-records/audit-harness/0009-rbac-policy.md`)
as the architectural decision record for the RBAC slice (T224-T227). Update
ADR 0007's "Out of scope" trailing block to point at ADR 0009 for
`session.permittedWorkspaces` enforcement. Append a new row to the ADR
README index. Docs-only — no code changes, no test additions.

## 2. Repo context discovered

- T224 (`packages/shared/src/auth/roles-schema.ts`) introduced the role
  data model (`Role`, `RoleGrant`, `ScopeKind`, `ActorKind`, `RbacAction`)
  plus the frozen `SYSTEM_ROLES` registry.
- T225 (`packages/shared/src/auth/policy-engine.ts`) introduced the pure
  function `evaluate(grants, action, resource)` returning
  `{allow, reason}` plus `permittedWorkspaces(grants)` with the `'*'`
  global sentinel.
- T226 (`packages/shared/src/auth/rbac-resolver.ts`) introduced the
  `GrantStore` interface, `InMemoryGrantStore` fake, and `RbacResolver`
  indirection. The resolver delegates to the policy engine and is
  consumed by `deriveScopeFromAuth` through
  `session.permittedWorkspaces`. It is opt-in via
  `HandlerDeps.rbacResolver`; when absent the C.4 "always permit"
  behaviour from `AccountStore.listWorkspaceIds` is preserved.
- T227 (`packages/server-core/src/handlers/rpc/roles.ts`) introduced the
  admin RPC channels (`roles.list/create/grant/revoke`), the
  `RoleStore` interface, `InMemoryRoleStore` fake,
  `GrantStore.grant`/`revoke` mutation methods, and the
  `RbacResolver.ownerGrantsForUser` plus `invalidateUser` cache-bust
  contract. Mutating handlers gate on owner-on-scope (or global owner).
- ADR 0007 (`docs/decision-records/audit-harness/0007-multi-tenant-storage-isolation.md`)
  closes a similar loop for storage tenancy: it carries an explicit
  "RBAC-owned `session.permittedWorkspaces` population" item in its
  "Out of scope" section, which is the natural anchor for the
  bidirectional cross-reference to ADR 0009.
- ADR 0005 demonstrates the cross-reference style we mirror: a multi-line
  trailing block under "Out of scope" that points at the implementing
  ADR.
- The ADR README index (`docs/decision-records/audit-harness/README.md`)
  uses a table with `| ADR | Title | Status |` columns. Reserved slots
  are flipped to `accepted` when filled.
- The goal doc (Phase 2 §4 cluster) names the ADR explicitly as
  `T230-rbac-adr — 0009-rbac-policy.md` with the canonical sentence
  "ADR records the policy model, why a pure-function engine, and the
  migration path from C.4's 'always permit' stub."

## 3. Files inspected

- `docs/superpowers/goals/2026-05-13-agent-workbench-suite-master-roadmap-goal.md`
  (Phase 2 §4 cluster: T224-T230 plan, stopping condition).
- `docs/decision-records/audit-harness/0005-storage-tenancy-contract.md`
  (cross-reference style under "Out of scope" pointing at ADR 0007).
- `docs/decision-records/audit-harness/0006-account-identity-foundation.md`
  (sibling ADR style — heavier on threat-model tables, lighter on
  invariants).
- `docs/decision-records/audit-harness/0007-multi-tenant-storage-isolation.md`
  (primary structural template: canonical / why / follow-up status /
  security implications / verification gates).
- `docs/decision-records/audit-harness/README.md` (index format and
  row-flip protocol).
- `packages/shared/src/auth/roles-schema.ts` (T224 types and
  SYSTEM_ROLES).
- `packages/shared/src/auth/policy-engine.ts` (T225 pure function
  evaluator).
- `packages/shared/src/auth/rbac-resolver.ts` (T226 GrantStore +
  RbacResolver + ownerGrantsForUser + invalidateUser).
- `packages/shared/src/auth/role-store.ts` (T227 RoleStore interface).
- `packages/server-core/src/handlers/rpc/roles.ts` (T227 admin RPC
  surface).
- `docs/tickets/T224-T227-*.md` and corresponding worklogs (verified
  acceptance criteria language for impl references in the ADR).

## 4. Tests added first

None — this is a docs-only ADR. Validation is via `validate:docs`,
`validate:rebrand`, and `git diff --check`. No unit, integration, or
E2E tests are added.

## 5. Expected failing test output

N/A (docs-only).

## 6. Implementation changes

- Created `docs/decision-records/audit-harness/0009-rbac-policy.md`
  with the following structure (mirroring ADR 0007):
  - Header: status `accepted`, date `2026-05-13`, implements line
    referencing ADR 0007's "RBAC-owned `session.permittedWorkspaces`
    population" out-of-scope item.
  - `## Canonical`: one-sentence summary plus a multi-line technical
    block describing the policy engine + resolver + RPC surface.
  - `## Decisions`: seven numbered decisions:
    1. Policy engine is a pure function over `RoleGrant[]`.
    2. Three system-managed roles only: owner / editor / viewer.
    3. Scope kinds: workspace / org / global with `'*'` global sentinel.
    4. RbacResolver is the indirection over `GrantStore`.
    5. Owner-only mutations via `assertOwnerOnScope` helper in
       `roles.ts`.
    6. HandlerDeps integration is opt-in (C.4 fallback preserved).
    7. Migration path from C.4 "always permit" stub.
  - `## Invariants`: five invariants (pure-function policy, owner-only
    grant, idempotent revoke, resolver invalidation on revoke,
    system-role immutability).
  - `## Implementation references`: the M.2 file list (T224-T229 +
    T228).
  - `## Out of scope`: persistence beyond in-memory fake, audit
    logging of grants/revokes, custom role permissions matrix UI,
    org-level RBAC.
- Updated `docs/decision-records/audit-harness/0007-multi-tenant-storage-isolation.md`'s
  "Follow-up Status" section: appended a one-line "Updated 2026-05-13"
  cross-reference to ADR 0009 (mirrors how ADR 0005 cross-references
  ADR 0007).
- Updated `docs/decision-records/audit-harness/README.md`: appended a
  new row for ADR 0009 with `accepted` status and a link to the new
  file.

## 7. Validation commands run

- `bun run validate:docs` — pre-existing failures unchanged; new ADR
  passes link checks and front-matter format.
- `bun run validate:rebrand` — exits 0.
- `bun run validate:roadmap` — pre-existing stale row state unchanged.
- `git diff --check` — clean.

## 8. Passing test output summary

N/A (docs-only). Validation evidence is the exit code of
`bun run validate:rebrand` (0) and the absence of new failures from
`bun run validate:docs`.

## 9. Build output summary

No build was run. T230 is a docs-only closeout; the bun + Electron
build is exercised by T228 when the admin UI ships.

## 10. Remaining risks

- The ADR documents an opt-in enforcement model. Hosts that ship in
  multi-tenant mode without wiring `rbacResolver` will silently fall
  back to C.4's "always permit" path. This is intentional (backward
  compat with single-user runtimes) but operators must audit
  `HandlerDeps` initialisation before flipping `ROX_MULTI_TENANT=1`.
- ADR 0009's "Out of scope" defers persistence to M.6. Until a DB-backed
  `GrantStore` lands, grants are in-process only and are lost on
  restart. Documented but worth re-flagging in the M.6 ticket.
- `RbacResolver.invalidateUser` is a no-op stub today. The caching layer
  that lands with persistent storage MUST override this method or stale
  permitted-workspace arrays will persist across the revoke boundary.
  Documented in invariant 4 of the ADR.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| ADR 0009 exists with canonical + 7 decisions + 5 invariants + impl refs + out-of-scope | Green | `docs/decision-records/audit-harness/0009-rbac-policy.md` |
| ADR 0007 carries a one-line cross-reference to ADR 0009 | Green | Trailing line in "Follow-up Status" section |
| ADR README index lists ADR 0009 with `accepted` status | Green | New table row |
| Worklog complete (11 sections) | Green | This file |
| `validate:rebrand` exits 0 | Green | Section 7 |
| Commit created | Green | Atomic commit per Lore protocol |
