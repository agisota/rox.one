# T244 - Reserve `'*'` as forbidden workspace `scopeId` at schema layer

Status: DONE

## Context

We are building a white-label fork of Craft Agents OSS into the
ROX.ONE Agent Workbench Suite.

Relevant product goals:

- local desktop app
- managed web/cloud app
- user/team workspaces
- prompt modes
- multi-agent workflows
- validation gates
- TDD-first implementation

T243 (already merged to `main`) shipped property-based scope-forgery
fuzz tests for the RBAC policy engine. Property 3 surfaced
**Finding A**: a smuggled grant
`{ scopeKind: 'workspace', scopeId: '*' }` produces a
`permittedWorkspaces` output (`['*']`) observationally identical to
the global-owner sentinel
`PERMITTED_WORKSPACES_GLOBAL_SENTINEL = '*'`. Today
`deriveScopeFromAuth` dampens the ambiguity by consulting
`RbacResolver.ownerGrantsForUser` as a separate signal, but the
defence-in-depth fix is to close the hole at the schema boundary:
the store should never persist a grant whose `scopeId === '*'` for a
workspace or org scope.

T244 is the M.13 (security hardening) follow-on. It adds a schema-
layer `validateRoleGrant` function, wires it into the `RoleStore` /
`GrantStore` mutation paths, and pins the behaviour with a new test
suite plus an additional property in the T243 fuzz file.

## Scope

1. Add `validateRoleGrant(grant) → Result<RoleGrant, ValidationError>`
   to `packages/shared/src/auth/roles-schema.ts`. Rejection rules:
   - `scopeId === '*'` on workspace/org → `reserved-scope-id`
   - `scopeId === ''` on workspace/org → `empty-scope-id`
   - `scopeKind === 'global'` with non-null `scopeId` → `global-scope-with-id`
   - workspace/org with `scopeId === null` → `scoped-without-id`
   - unknown `scopeKind` / `actorKind` values → `unknown-*-kind`
   - empty `roleId` / `actorId` → `empty-*-id`
   - non-string `scopeId` (other than `null`) → `non-string-scope-id`
2. Add a throwing variant `assertValidRoleGrant(grant)` for call
   sites that prefer exceptions; the thrown `Error` carries a typed
   `.code` property.
3. Export `RESERVED_WORKSPACE_SENTINEL_ID = '*'`,
   `VALID_ACTOR_KINDS`, and `VALID_SCOPE_KINDS` as the canonical
   sources of truth.
4. Wire the validator into the `InMemoryGrantStore` mutation
   boundary (`constructor` seed + `grant()`). `revoke()` stays
   permissive so operators can clean up legacy pre-T244 grants.
5. New test file
   `packages/shared/src/auth/__tests__/schema-reservation.test.ts`
   with 31 cases / 135 expect() calls covering every reject path,
   the happy-path matrix, and the grant-store enforcement boundary.
6. Extended T243 property test with an additional ≥2000-iteration
   property asserting the validator rejects the smuggled `'*'` grant
   and accepts every legitimate grant.

## Out of scope

- Changes to the `RoleGrant` interface shape (additive only at the
  validator layer per the prompt rules).
- Plumbing the validator into the RPC handlers in
  `packages/server-core/src/handlers/rpc/roles.ts`. The
  defence-in-depth layer is already the store; surfacing a clean
  `invalid-argument` reason at the RPC layer lands in T246 once the
  T244 schema layer has soaked in `main`.
- Persistence-backed stores (Postgres, etc). The validator is pure
  and storage-agnostic; future stores import it the same way the
  in-memory store does.

## Implementation notes

- `validateRoleGrant` is pure, never throws, never mutates. It
  returns a discriminated `Result` union; the `ok: true` branch
  carries a `grant` field referentially equal to the input.
- The throwing variant `assertValidRoleGrant` wraps the result in an
  `Error` whose message embeds the validation code and exposes a
  `.code` property for branching consumers.
- `InMemoryGrantStore.constructor` calls `assertValidRoleGrant` on
  every seeded grant *before* the actor-kind filter so that a
  smuggled grant cannot slip through the team-actor early-return.
- `InMemoryGrantStore.grant()` calls `assertValidRoleGrant` first,
  then preserves the existing dedup + actor-kind filter.
- `revoke()` is deliberately left validation-free so legacy grants
  persisted before T244 (e.g. a smuggled `scopeId === '*'`) can
  still be cleaned up via the normal API.
- The error message for `reserved-scope-id` names both the literal
  `'*'` and the offending `scopeKind` so reviewers can audit log
  lines without re-running with extra debug.
- Lookalike scope ids (`'*abc'`, `'**'`, `'foo*'`, `'-*'`) are
  legitimate workspace ids and pass the validator. Only the literal
  `'*'` is reserved.

## Validation gates

- `bun test packages/shared/src/auth/__tests__/` — 198 / 206 pass
  (8 pre-existing failures from missing optional deps `tar`,
  `@anthropic-ai/claude-agent-sdk`, and an unrelated GitHub MCP E2E
  network call — verified to exist on `main` via `git stash`).
- `bun test packages/shared/src/auth/__tests__/schema-reservation.test.ts` —
  31 / 31 pass, 135 expect() calls, ~44 ms.
- `bun test packages/shared/src/auth/__tests__/scope-forgery.property.test.ts` —
  6 / 6 pass, 9347 expect() calls, ~70 ms.
- `bun run validate:rebrand` — pass.
- `bun run validate:agent-contract` — pass.
- `bun run validate:roadmap` — pass.

## Follow-ups

- **T245** — observability producer surface (already DONE).
- **T246** — plumb the validator into the RPC handlers so
  `roles.grant` returns a clean
  `{error: 'invalid-argument', reason: 'reserved-scope-id'}` instead
  of a 500 from the store-level throw.
- **M.14 retro** — verify Postgres-backed `GrantStore` (when it
  lands) imports `assertValidRoleGrant` at the same boundary.

## Threat closed

A persistence-layer attacker (compromised admin RPC, malicious
migration, hand-crafted JSON payload smuggled through a future
import-grants path) can no longer persist
`{scopeKind: 'workspace', scopeId: '*'}`. The store rejects on
seed-time validation; the resolver therefore never serves a smuggled
grant that would impersonate the global-owner sentinel in
`permittedWorkspaces` output.
