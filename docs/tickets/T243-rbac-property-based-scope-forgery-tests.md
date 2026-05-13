# T243 - RBAC property-based scope-forgery + cross-tenant smuggling tests

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

C.4 landed `BrandedWorkspaceScope` — an opaque, brand-typed handle
that prevents callers from spoofing a workspace id at the type level.
M.2 RBAC (T224–T228) chained `permittedWorkspaces` through
`deriveScopeFromAuth` so that the runtime scope a session can touch is
computed from RBAC grants. The threat model says any attacker forging
a scope handle or smuggling a foreign workspace id MUST be rejected
at the policy boundary, never at the storage layer (defence in depth
is welcome but the policy boundary is the canonical gate).

T243 is the M.13 (security hardening) first ticket. It proves the
boundary is forgery-resistant under adversarial inputs using
property-based fuzz tests.

## Scope

Add `packages/shared/src/auth/__tests__/scope-forgery.property.test.ts`
with hand-rolled deterministic property generators (the repository does
not depend on `fast-check`). The file asserts five properties, four
adversarial and one positive smoke-check:

1. **Forged role ids never grant any action.** Random non-system role
   ids fed into `evaluate(grants, action, resource)` produce
   `allow: false` for any action × resource pair.
2. **Workspace grants never leak across workspace ids.** A grant on
   workspace A plus arbitrary noise grants never permits any action on
   workspace B.
3. **Global sentinel cannot be impersonated.** A pure-forgery grant
   `{ scopeKind:'workspace', scopeId:'*' }` produces an output array
   `['*']` that is observationally identical to the real global
   sentinel — the test pins this so the ambiguity does not silently
   change, and the worklog documents the finding (a callers-must-know
   constraint, currently relied on by `deriveScopeFromAuth`).
4. **Scope-kind discipline holds.** Org grants do not satisfy
   workspace resources and vice versa, even when the `scopeId` matches.
5. **Positive smoke** — without this, the four always-deny properties
   would be vacuously satisfied by an `evaluate` that always denies.

Each adversarial property runs ≥1000 random iterations seeded from
`process.env.T243_SEED` (default `0x5a3e1c7d`). Total iterations:
≥4000. Failures print the seed + iteration index for deterministic
reproduction.

## Out of scope

- Patching the global-sentinel ambiguity surfaced by Property 3. The
  fix lands in T244 (reserve `'*'` as a forbidden `scopeId` in the
  roles schema validator).
- Property tests for the `RoleStore`, `RbacResolver`, or the admin RPC
  handlers. Those land in T245+ as separate slices.

## Implementation notes

- Generators are pure xorshift32. Seeds are surfaced in failure
  messages so any property failure reproduces verbatim.
- The test file imports the real `evaluate` and `permittedWorkspaces`
  from `../policy-engine.ts` — no mocking of the policy engine.
- `Object.freeze` on the sentinel return is observable from outside;
  the smoke test pins both the value and the shape.
- The file is ≤320 LOC.

## Validation gates

- `bun test packages/shared/src/auth/__tests__/scope-forgery.property.test.ts` —
  5 cases / 6347 expect() calls / ~53 ms wall.
- `bun run validate:rebrand` — green.
- `bun run validate:agent-contract` — green.
- `bun run validate:roadmap` — green.

## Follow-ups

- **T244** — reserve `'*'` as a forbidden workspace `scopeId` in
  `roles-schema` validators so the global sentinel cannot be
  impersonated by a smuggled workspace grant. The current
  ambiguity is dampened in practice by `deriveScopeFromAuth`
  consulting `RbacResolver.ownerGrantsForUser` separately, but
  defence in depth says we should close the hole at the schema
  boundary.
- **T245** — property tests for `RbacResolver` + `RoleStore`
  mutations (already covered partially by unit tests; properties
  add the random-input fuzz coverage).
- **T246** — property tests for the admin RPC handlers'
  owner-gate (`assertOwnerOnScope`) under random adversarial
  grant lists.
