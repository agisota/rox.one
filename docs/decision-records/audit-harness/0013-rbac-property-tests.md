# Decision 0013: RBAC Property-Based Tests and Schema-Layer Reservation

- Status: accepted
- Date: 2026-05-13
- Implements: T243 (scope-forgery property tests) and T244 (schema-layer
  reservation of `'*'`). Companion to ADR 0009 (RBAC policy) and
  ADR 0012 (input validation).
- Source tickets:
  `docs/tickets/T243-rbac-property-based-scope-forgery-tests.md`,
  `docs/tickets/T244-schema-reservation-asterisk.md`.

## Canonical

RBAC must be forgery-resistant under adversarial inputs verified by
property-based fuzz tests (>=4000 iterations) AND schema-level
reservation of sentinel values.

```text
property_tests:
  file: packages/shared/src/auth/__tests__/scope-forgery.property.test.ts
  generators:
    type:     hand-rolled deterministic xorshift32
    seed:     process.env.T243_SEED, default 0x5a3e1c7d
    contract: failure messages print seed + iteration index
  properties:
    1: forged role ids never grant any action
    2: workspace grants never leak across workspace ids
    3: global sentinel cannot be impersonated (pinning property)
    4: scope-kind discipline holds (org/workspace are not interchangeable)
    5: positive smoke (defeats vacuously-true always-deny)
    6: validator rejects smuggled '*' grant (added by T244)
  budget:
    per_property: >=1000 iterations (>=2000 for property 6)
    total:        >=4000 iterations
  fixtures: zero — every grant is generator-produced

schema_reservation:
  file: packages/shared/src/auth/roles-schema.ts
  validator:
    pure:      validateRoleGrant(grant) -> Result<RoleGrant, ValidationError>
    throwing:  assertValidRoleGrant(grant) -> RoleGrant | throws
  reservation:
    constant:  RESERVED_WORKSPACE_SENTINEL_ID = '*'
    rule:      scopeId === '*' on workspace|org -> reserved-scope-id
  wiring:
    constructor_seed: InMemoryGrantStore validates every seed
    mutation_path:    InMemoryGrantStore.grant() validates first
    revoke_path:      permissive (legacy cleanup)
  reject_codes:
    reserved-scope-id | empty-scope-id | global-scope-with-id |
    scoped-without-id | unknown-scope-kind | unknown-actor-kind |
    empty-role-id | empty-actor-id | non-string-scope-id
```

## Decisions

Six decisions, each with rationale.

### 1. Property-based tests use hand-rolled deterministic generators

The repository does not depend on `fast-check`. T243 ships pure
`xorshift32` generators that surface their seed in every failure
message. Reproduction is one `T243_SEED=<value> bun test ...` away.

**Reasons.**

- **Zero new external dep.** Property testing is a one-file
  addition; we do not pull in a fuzz library for a single test
  suite.
- **Deterministic reproduction.** The seed appears in the failure
  output; reviewers re-run with the same seed and reproduce the
  exact iteration.
- **Same engine for related slices.** Future property suites
  (`T245` resolver, `T246` admin owner-gate) reuse the same
  generator scaffolding without forking the dep choice.

### 2. Four adversarial properties plus one positive smoke

Pure adversarial properties ("always deny") can be vacuously
satisfied by an `evaluate` that returns `{ allow: false }` for
every input. Property 5 (positive smoke) pins a known-good
grant produces `allow: true` so the adversarial set carries real
signal.

**Reasons.**

- **Defeats trivial regressions.** A future refactor that
  accidentally makes `evaluate` always-deny does not pass the
  property suite.
- **Documents intent.** A reviewer reading the file sees both
  "what must never happen" and "what must keep working".

### 3. Property 3 pins the global-sentinel ambiguity until T244 closes it

T243 discovered Finding A: a smuggled grant
`{ scopeKind: 'workspace', scopeId: '*' }` produces a
`permittedWorkspaces` output observationally identical to the
real global sentinel. Property 3 pins this in place so the
ambiguity does not silently change. T244 closes the hole at
the schema boundary and Property 6 verifies the close.

**Reasons.**

- **Pin first, fix next.** Pinning gives a single commit on
  `main` that captures "this is the state today" before the
  defence-in-depth fix lands. Reviewers can audit the gap.
- **The runtime gate remains correct.** `deriveScopeFromAuth`
  consults `RbacResolver.ownerGrantsForUser` as a separate
  signal; the property test documents that without depending
  on the runtime gate.

### 4. Schema reservation is the canonical close

T244 reserves `'*'` as a forbidden workspace/org `scopeId` at
the schema layer (`roles-schema.ts::validateRoleGrant`). The
`InMemoryGrantStore` constructor and `grant()` paths call
`assertValidRoleGrant` before any mutation. The store cannot
persist a smuggled grant; the resolver cannot serve one.

**Reasons.**

- **Pure validator.** The function has no I/O, no env reads,
  no clock. It runs in the same module as the data shapes it
  validates, so a single read defines both the type and the
  rule.
- **Store enforcement at construction time.** Seeded grants
  pass through the validator BEFORE the actor-kind filter,
  so a smuggled grant cannot slip via the team-actor early
  return.
- **Revoke remains permissive.** Operators cleaning up legacy
  pre-T244 grants (in dev databases or migration paths) can
  still revoke smuggled rows. Tightening revoke would create
  a stuck state.

### 5. Lookalike scope ids pass; only literal `'*'` is reserved

`'*abc'`, `'**'`, `'foo*'`, `'-*'` are legitimate workspace ids.
Reservation is exact-string equality against `'*'`.

**Reasons.** Workspaces in production may carry asterisks in
display strings without colliding with the sentinel. A single
literal token keeps the contract auditable; future tickets can
extend the list explicitly.

### 6. Validator rejection codes are typed; never string-matched

Every rejection path returns a discriminated `Result.error.code`
from the closed union enumerated in the canonical block above.
Callers branch on `code`, never on the message prose.

**Reasons.**

- **Stable client contract.** The grant-store API and the
  future RPC `roles.grant` surface (T246 follow-up) return
  `{ error: 'invalid-argument', reason: <code> }` envelopes
  using these codes verbatim.
- **Telemetry on rule-level dimensions.** Counters can be
  dimensioned by `code` to detect which class of smuggling
  attempt is being attempted in the wild.

## Invariants

Three invariants the property+schema slice holds.

### 1. >=4000 random iterations on every property suite run

Enforced by:

- `scope-forgery.property.test.ts` — five adversarial properties
  at >=1000 iterations each plus the T244 validator property at
  >=2000. Failure prints seed + iteration index.

### 2. Smuggled `'*'` cannot be persisted

Enforced by:

- `InMemoryGrantStore.constructor` — `assertValidRoleGrant` on
  every seeded grant before the actor-kind filter.
- `InMemoryGrantStore.grant()` — `assertValidRoleGrant` first,
  then dedup + filter.
- `schema-reservation.test.ts` — 31 cases covering every reject
  path, the happy-path matrix, and store enforcement.

### 3. Pre-T244 grants can still be revoked

Enforced by structure: `revoke()` does not call the validator.
Operators cleaning up legacy data use the normal API.

## Out of scope

- **RPC handler surfacing of reject codes.** T246 plumbs the
  validator into `roles.grant` so the RPC layer returns
  `{error: 'invalid-argument', reason: 'reserved-scope-id'}`
  instead of a 500 from the store throw.
- **Persistent stores beyond the in-memory fake.** A future
  Postgres-backed `GrantStore` MUST import
  `assertValidRoleGrant` at the same boundary; the validator
  is storage-agnostic.
- **Property suites for the resolver and admin RPC handlers.**
  Tracked under T245 (resolver) and T246 (admin owner-gate).
