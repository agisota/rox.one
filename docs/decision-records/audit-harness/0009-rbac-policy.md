# Decision 0009: RBAC Policy

- Status: accepted
- Date: 2026-05-13
- Implements: ADR 0007's deferred "RBAC-owned `session.permittedWorkspaces`
  population" item

## Canonical

RBAC enforcement is a pure-function policy engine driven by `RoleGrant[]`,
indirected through `RbacResolver`, wired into `session.permittedWorkspaces`
consumed by C.4's `deriveScopeFromAuth`.

```text
rbac_policy:
  data_model:
    roles:                 [owner, editor, viewer]   # system, frozen
    custom_roles:          allowed via roles.create   # id must not collide
    grant:
      roleId:              owner | editor | viewer | <custom>
      actorKind:           user | team
      actorId:             string
      scopeKind:           workspace | org | global
      scopeId:             string | null              # null when global
  engine:
    file:                  packages/shared/src/auth/policy-engine.ts
    signature:             evaluate(grants, action, resource) -> {allow, reason}
    purity:                no I/O, no env reads, no mutation, deterministic
    auxiliary:             permittedWorkspaces(grants) -> string[]
    global_sentinel:       '*'                        # exported constant
  resolver:
    file:                  packages/shared/src/auth/rbac-resolver.ts
    methods:
      permittedWorkspacesForUser:  Promise<readonly string[]>
      ownerGrantsForUser:          Promise<readonly RoleGrant[]>
      invalidateUser:              void              # cache-bust hook
    store:                 GrantStore (in-memory today, DB-backed in M.6)
  rpc:
    file:                  packages/server-core/src/handlers/rpc/roles.ts
    channels:              roles.list | roles.create | roles.grant | roles.revoke
    guard:                 checkOwnerOnScope() — global owner OR scope-matched owner
    errors:                {error: 'permission-denied'|'rbac-not-configured'|
                            'invalid-argument'|'role-id-conflict', reason: string}
  integration:
    consumer:              packages/shared/src/config/storage-scope-auth.ts
    contract:              session.permittedWorkspaces = await
                           rbacResolver.permittedWorkspacesForUser(userId)
                           (M.2 path) OR
                           accountStore.listWorkspaceIds(userId)
                           (C.4 fallback when rbacResolver is undefined)
    runtime_gate:          ROX_MULTI_TENANT=1 (inherited from ADR 0007)
```

`HandlerDeps.rbacResolver`, `HandlerDeps.roleStore`, and
`HandlerDeps.grantStore` are all optional. When absent, the system
preserves C.4's "always permit" behaviour. When present, the policy engine
gates `session.permittedWorkspaces`.

## Decisions

Seven decisions, each with rationale.

### 1. Policy engine is a pure function over `RoleGrant[]`

`evaluate(grants, action, resource)` and `permittedWorkspaces(grants)`
live in `packages/shared/src/auth/policy-engine.ts`. The module has zero
imports of runtime services: no `fs`, no `node:crypto`, no
`process.env`, no `Date.now()`, no logger. Same inputs always produce
the same output; the result of `permittedWorkspaces` is `Object.freeze`d
before return so callers cannot accidentally mutate it.

**Reasons:**

- **Testability.** Every action × scope combination can be unit-tested
  exhaustively from a plain `RoleGrant[]` literal. No fakes, no
  fixtures, no setup teardown.
- **Predictability.** A policy decision cannot become flaky based on
  load order, environment, or stale process state.
- **Portability.** The engine can run in the renderer for optimistic UI
  checks, in the server for authoritative checks, in an edge worker for
  pre-routing, or in a future server-side eval at row-level — all from
  the same module.
- **Auditability.** A code reviewer can read the entire decision
  surface in one file without chasing imports through a persistence
  adapter.

### 2. Three system-managed roles only: `owner` / `editor` / `viewer`

`SYSTEM_ROLES` in `packages/shared/src/auth/roles-schema.ts` declares
exactly three roles. The map from role id to action set in
`policy-engine.ts` (`ROLE_ACTIONS`) hardcodes:

- `owner` → `{read, write, admin}`
- `editor` → `{read, write}`
- `viewer` → `{read}`

Custom roles are allowed (added via `roles.create`) but their id must
not collide with a system role id (`role-id-conflict` error). Custom
roles inherit no actions today — the policy engine treats unknown role
ids as "no actions". A future ticket extends `roles.create` to declare
per-role action sets.

**Reasons:**

- **Simple mental model.** Three roles cover the common cases (admin,
  contributor, observer) without forcing operators to design a custom
  matrix on day one.
- **Predictable defaults.** A grant of `owner` always carries
  `{read, write, admin}` regardless of which deployment installed
  Agent Workbench Suite.
- **Room to grow.** Custom-role ids are reserved per workspace
  (effectively global by store design), so an operator can ship
  `'reviewer'` or `'analyst'` without forking the engine.

### 3. Scope kinds: `workspace` / `org` / `global`

`ScopeKind` in `roles-schema.ts` is the closed union
`'workspace' | 'org' | 'global'`. `RoleGrant.scopeId` is `string` for
`workspace` and `org` grants and `null` for `global` grants. Global
grants apply to everything: `permittedWorkspaces` emits the sentinel
`'*'` when any grant is a global-scope read, and callers MUST treat
that sentinel as "no workspace filter" rather than as a workspace id.

**Reasons:**

- **Matches the existing storage tenancy contract** (ADR 0005). The
  `WorkspaceScope` discriminated union already names workspace and
  global storage roots; ScopeKind is the corresponding authorisation
  surface.
- **Supports cross-workspace operations** for support / admin
  personas. A platform operator with a global owner grant can manage
  every tenant's grants from a single admin surface without
  re-binding per workspace.
- **Org-level grants remain expressible.** `ScopeKind` includes
  `'org'` so the type system carries org-scope grants today, even
  though end-to-end org-RBAC wiring is deferred to a future phase
  (see "Out of scope").

### 4. `RbacResolver` is the indirection

`RbacResolver` in `packages/shared/src/auth/rbac-resolver.ts` is the
only consumer of the pure-function engine from runtime code. It
wraps a `GrantStore` (in-memory `InMemoryGrantStore` today,
DB-backed in M.6) and exposes:

- `permittedWorkspacesForUser(userId)` — used by the M.2 path in
  `deriveScopeFromAuth`.
- `ownerGrantsForUser(userId)` — used by `roles.ts` to gate
  mutations.
- `invalidateUser(userId)` — cache-bust hook called by `roles.revoke`
  after a successful removal. Today it is a no-op stub; the M.6
  caching layer MUST override it.

**Reasons:**

- **Decouples enforcement from storage.** Callers in
  `deriveScopeFromAuth` never touch the policy engine directly; they
  ask the resolver. Replacing the in-memory store with a DB-backed
  one does not touch any caller.
- **Centralises async I/O.** The pure engine has zero `Promise`s.
  The resolver is the I/O boundary; it `await`s the store and hands
  back a `ReadonlyArray<string>`.
- **Carries the invalidation contract forward.** Today the no-op is
  free, but the method is on the interface, so a caching layer
  cannot ship without consciously overriding it.

### 5. Owner-only mutations via `checkOwnerOnScope` helper

`packages/server-core/src/handlers/rpc/roles.ts` declares an internal
`checkOwnerOnScope(deps, ctx, scopeKind, scopeId)` helper. Every
mutating handler (`create`, `grant`, `revoke`) calls it before any
state change. The helper:

- Returns `{error: 'permission-denied', reason: 'no-user'}` for
  anonymous callers.
- Returns `{error: 'rbac-not-configured', reason: 'no-rbac-resolver'}`
  when the resolver is unwired.
- Asks the resolver for the caller's owner grants and returns
  `{error: 'permission-denied', reason: 'no-owner-grant'}` unless the
  caller holds a global owner grant OR a scope-matching owner grant.

`roles.create` always calls the helper with `('global', null)` because
custom roles are global by definition.

**Reasons:**

- **Single audit point.** A reviewer auditing "where do we check who
  can grant?" reads exactly one helper. No copy-paste of permission
  checks across four handlers.
- **Consistent error shape.** All denial paths return the same
  `{error, reason}` envelope, mirroring C.4's `MultiTenantForgeryError`
  pattern. Clients can branch on `reason` for telemetry without
  string-matching error messages.
- **Future-proof for cross-scope grants.** When a future ticket
  introduces, e.g., team-actor grants on workspace scope, the helper
  is the natural place to add the check; the four call sites do not
  change.

### 6. HandlerDeps integration is opt-in

`HandlerDeps` carries `rbacResolver?: RbacResolver`,
`roleStore?: RoleStore`, and `grantStore?: GrantStore` as optional
fields. When all three are undefined, the system preserves C.4's
behaviour:

- `deriveScopeFromAuth` falls back to
  `accountStore.listWorkspaceIds(userId)` for
  `session.permittedWorkspaces` (the C.4 path).
- `roles.list` still returns `SYSTEM_ROLES` (the catalog is always
  readable).
- `roles.create`, `roles.grant`, and `roles.revoke` respond with
  `{error: 'rbac-not-configured'}`.

When the three deps are wired (multi-tenant runtime, production), the
policy engine gates `session.permittedWorkspaces`.

**Reasons:**

- **Single-user runtimes do not pay for RBAC.** The Electron desktop
  app, the local dev harness, and most unit tests run with
  `rbacResolver === undefined` and see no behaviour change. The C.4
  "always permit" baseline is preserved by absence.
- **Multi-tenant runtimes opt in explicitly.** Operators wire the
  resolver only after they have provisioned grants. The act of
  wiring is the activation gate, in addition to the
  `ROX_MULTI_TENANT=1` runtime flag from ADR 0007.
- **Tests can mix-and-match.** A test that needs RBAC wires a real
  `RbacResolver` over an `InMemoryGrantStore` seeded with literal
  grants. A test that doesn't care leaves the dep undefined.

### 7. Migration path from C.4 "always permit" stub

Before M.2, `session.permittedWorkspaces` came from
`accountStore.listWorkspaceIds(userId)` — which returned every
workspace the user owned in the account DB. This was the C.4 "always
permit" stub: any signed-in user could reach any of their own
workspaces.

After M.2, `session.permittedWorkspaces` comes from
`policyEngine.permittedWorkspaces(grants)` via
`resolver.permittedWorkspacesForUser(userId)` when an
`rbacResolver` is wired. The migration is gated on three
conditions, in order:

1. `ROX_MULTI_TENANT=1` (ADR 0007's runtime flag).
2. `HandlerDeps.rbacResolver` is non-undefined (this ADR's wiring
   gate).
3. The user has at least one grant in the store.

When `grants = []` (the default in a fresh `InMemoryGrantStore`),
behaviour is identical to:

- "No permitted workspaces" in multi-tenant mode — every workspace
  request gets `MultiTenantForgeryError` from `deriveScopeFromAuth`.
- "All permitted" in single-user mode — the `kind: 'local-single-user'`
  scope is returned regardless.

This is backward compat preserved: a deployment that flips
`ROX_MULTI_TENANT=1` without first provisioning grants gets the
correct "no access" failure mode (fail-closed), and a deployment that
keeps `ROX_MULTI_TENANT=0` is unaffected.

**Reasons:**

- **Fail-closed by default.** The wrong move (flipping multi-tenant
  before provisioning grants) produces zero permitted workspaces,
  which is the safe outcome.
- **No data migration required.** The account DB still holds
  workspace ownership; RBAC grants are an additive table (in-memory
  today, DB-backed in M.6). Existing accounts work unchanged in
  single-user mode.
- **Single migration step from M.6 onwards.** Once the persistent
  `GrantStore` lands, the migration tool from T222 (multi-tenant
  data migration) extends to seed initial owner grants from
  `account.workspaceIds`, in a single backfill.

## Invariants

Five invariants the M.2 RBAC slice holds. Each is enforced by code
referenced by file path.

### 1. Pure-function policy

`evaluate(grants, action, resource)` and `permittedWorkspaces(grants)`
are deterministic, idempotent, and free of I/O. Same inputs always
produce the same output. Enforced by:

- `packages/shared/src/auth/policy-engine.ts` — zero imports of
  runtime services.
- `packages/shared/src/auth/__tests__/policy-engine.test.ts` — full
  unit coverage of every action × scope combination.

### 2. Owner can grant; non-owner cannot

Every mutating handler in `roles.ts` calls `checkOwnerOnScope` before
state change. A caller without an owner grant on the target scope (and
without a global owner grant) receives
`{error: 'permission-denied', reason: 'no-owner-grant'}`. Enforced by:

- `packages/server-core/src/handlers/rpc/roles.ts` —
  `checkOwnerOnScope` call site in every mutating handler.
- `packages/server-core/src/handlers/rpc/__tests__/roles.test.ts` —
  unauthorised-caller test cases for `create`, `grant`, and `revoke`.

### 3. Idempotent revoke

`roles.revoke` returns `{ok: true, revoked: false}` when the grant
does not exist; this is not an error. Enforced by:

- `InMemoryGrantStore.revoke` returning `false` when nothing matched.
- `RbacResolver.invalidateUser` is NOT called when `revoked === false`
  (we do not over-evict on no-op revokes).
- `packages/server-core/src/handlers/rpc/__tests__/roles.test.ts` —
  `revoke when nothing matched` test case.

### 4. Resolver invalidation on revoke

`roles.revoke` calls `resolver.invalidateUser(grant.actorId)` after a
successful revoke when the actor is a user. Today the resolver's
`invalidateUser` is a no-op, but the contract is on the interface so
a future caching layer cannot ship without overriding it. Enforced by:

- `packages/server-core/src/handlers/rpc/roles.ts` lines 175-177:
  `if (revoked && grant.actorKind === 'user' && deps.rbacResolver)
   deps.rbacResolver.invalidateUser(grant.actorId)`.
- `packages/server-core/src/handlers/rpc/__tests__/roles.test.ts` —
  `resolver.permittedWorkspacesForUser(affected) reflects the change`
  test case (the test ensures the post-revoke read is consistent).

### 5. System roles are immutable

`SYSTEM_ROLES` is `Object.freeze`d at module scope and every entry is
also frozen. `roles.create` rejects any role whose id matches a
system-role id with `{error: 'role-id-conflict'}`. Enforced by:

- `packages/shared/src/auth/roles-schema.ts` — `Object.freeze` on the
  registry and on each entry.
- `packages/shared/src/auth/role-store.ts` —
  `InMemoryRoleStore.create` throws on system-id collision.
- `packages/server-core/src/handlers/rpc/roles.ts` — handler-level
  check via `SYSTEM_ROLES.some(r => r.id === role.id)` before
  delegating to the store.

## Implementation references

The M.2 RBAC slice landed across the following modules:

- `packages/shared/src/auth/roles-schema.ts` (T224) — `Role`,
  `RoleGrant`, `ScopeKind`, `ActorKind`, `RbacAction`, `SYSTEM_ROLES`,
  `isSystemRole`.
- `packages/shared/src/auth/policy-engine.ts` (T225) — `evaluate`,
  `permittedWorkspaces`, `PERMITTED_WORKSPACES_GLOBAL_SENTINEL`,
  `PolicyDecision`, `PolicyResource`.
- `packages/shared/src/auth/rbac-resolver.ts` (T226 + T227) —
  `GrantStore` interface (with T227 mutation methods),
  `InMemoryGrantStore`, `RbacResolver` with
  `permittedWorkspacesForUser`, `ownerGrantsForUser`, and
  `invalidateUser`.
- `packages/shared/src/auth/role-store.ts` (T227 part 1) — `RoleStore`
  interface, `InMemoryRoleStore`.
- `packages/server-core/src/handlers/rpc/roles.ts` (T227 part 2) —
  admin RPC handlers (`roles.list/create/grant/revoke`) gated by
  `checkOwnerOnScope`.
- `packages/server-core/src/handlers/rpc/__tests__/rbac-e2e.test.ts`
  (T229) — end-to-end RBAC integration test covering invite → grant →
  workspace access → revoke → loss of access.
- `apps/electron/src/renderer/components/settings/rbac/` (T228) —
  admin UI for the "Team & permissions" settings tab.
- `packages/shared/src/config/storage-scope-auth.ts` —
  `deriveScopeFromAuth` (the C.4 consumer) reads
  `session.permittedWorkspaces`, which the M.2 path populates from
  `resolver.permittedWorkspacesForUser(userId)`.
- `packages/server-core/src/handlers/handler-deps.ts` —
  `HandlerDeps.rbacResolver`, `roleStore`, `grantStore` optional fields.
- `packages/shared/src/protocol/channels.ts` — `RPC_CHANNELS.roles`
  namespace.

## Out of scope

The following items are deferred to future phases and are explicitly
NOT in M.2:

- **Persistence layer beyond the in-memory fake.** A DB-backed
  `GrantStore` / `RoleStore` is M.6 (production persistence adapter).
  Until then, grants are in-process only and are lost on restart. The
  M.6 ticket MUST also implement `RbacResolver.invalidateUser` as a
  cache-eviction hook (invariant 4).
- **Audit logging of grants and revokes.** Every successful `grant` /
  `revoke` should emit a structured audit event. Today the handlers
  return `{ok: true}` without an audit hook. Defers to M.14
  (observability + audit trail), which will wire the existing
  audit-storage infrastructure from ADR 0008 to RBAC mutations.
- **UI for managing custom role permissions matrix.** Custom roles
  can be created with `roles.create` but the action set assigned to a
  custom role is undefined (the engine maps `owner`/`editor`/`viewer`
  to action sets; unknown role ids map to no actions). A future ticket
  exposes the matrix in admin UI so an operator can define, for
  example, `'reviewer'` → `{read, comment}`.
- **Org-level RBAC.** `ScopeKind` carries `'org'` so the type system
  is ready, but no end-to-end flow exercises org grants today. Full
  org-level RBAC defers to a follow-up phase if and when orgs become
  a first-class feature (today, an "org" is a logical grouping of
  workspaces with no dedicated resource).
- **Team-actor grants on policy enforcement.** `ActorKind` carries
  `'team'` and `InMemoryGrantStore.grant` accepts team-actor grants
  but `RbacResolver.grantsForUser` only returns user-actor grants.
  Team membership resolution (a user is implicitly granted everything
  their teams hold) is a future ticket; today, a grant on a team has
  no effect on a user's permitted workspaces.
- **Tenant-aware rate limiting and quotas.** RBAC says "may this
  user act on this scope". Quotas say "how much may this user / team /
  workspace consume". Defers to a future phase.
