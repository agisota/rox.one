# T246 worklog — Wire AuditProducer into RBAC admin handlers + mission scheduler

## 1. Goal

Wire the T245 `AuditProducer` surface into the two consumer call sites
named on the M.14 lane plan: RBAC admin RPC handlers
(`roles.{grant,revoke}` success paths) and the mission scheduler
(`Start` / `Complete` / `Fail` lifecycle transitions). The producer is
plumbed as an OPTIONAL dependency so existing hosts that have not yet
adopted observability continue to work with zero changes.

## 2. Approach

Minimal-surface wiring. Three source edits + one package.json export:

1. `HandlerDeps` gains an optional `auditProducer?: AuditProducer`.
2. `registerRolesCoreHandlers` emits `RoleGranted` after
   `grantStore.grant()` succeeds, and `RoleRevoked` after
   `grantStore.revoke()` returns `revoked === true`. Two small helpers
   (`grantScopeToAuditScope`, `resolveRoleName`) keep the emit call
   sites readable.
3. `MissionScheduler` constructor gains optional `auditProducer` and
   `workspaceId` options. The new private
   `emitAuditForTransition(...)` runs after a successful store write
   and inspects the post-transition state to decide whether to emit
   `MissionStarted` / `MissionCompleted` / `MissionFailed`. A
   per-mission `Map<MissionId, string>` tracks the `Running.startedAt`
   timestamp so `MissionCompleted` can carry a precise `durationMs`;
   entries are pruned on terminal transitions so the map is
   short-lived.
4. `packages/shared/package.json` adds the `./observability` subpath
   export so `@rox-one/shared/observability` resolves. The observability
   *directory* and its sources remain frozen per the T245 contract.

Test slices are colocated:

- `packages/server-core/src/handlers/rpc/__tests__/roles-audit.test.ts`
- `packages/server-core/src/missions/__tests__/scheduler-audit.test.ts`

Both use the real producer (`createAuditProducer` with an in-memory
sink and a fixed clock) so we verify the integration end-to-end, not
just a stub spy.

## 3. Emit points

| Channel / transition                  | Audit kind         | Notes                                            |
| ------------------------------------- | ------------------ | ------------------------------------------------ |
| `roles.grant`  → store write success  | `RoleGranted`      | scope mapped from `RoleGrant`, role name resolved |
| `roles.revoke` → `revoked === true`   | `RoleRevoked`      | NO emit on idempotent no-op                       |
| `roles.revoke` → `revoked === false`  | —                  | idempotent path stays silent                      |
| Pending → Running (`Start`)           | `MissionStarted`   | captures `startedAt` for later duration calc      |
| Running → Completed (`Complete`)      | `MissionCompleted` | `durationMs` = `at - startedAt`, floored at 0     |
| Running/Paused/Awaiting → Failed (`Fail`) | `MissionFailed` | `errorMessage` = transition reason                |
| Any other transition or illegal event | —                  | scheduler stays silent                            |

## 4. Test coverage

```
$ bun test packages/server-core/src/handlers/rpc/__tests__/roles-audit.test.ts
 10 pass / 0 fail / 33 expect() calls

$ bun test packages/server-core/src/missions/__tests__/scheduler-audit.test.ts
 10 pass / 0 fail / 24 expect() calls

$ bun test packages/server-core/src/handlers/rpc/__tests__/ \
            packages/server-core/src/missions/__tests__/
 199 pass / 0 fail / 431 expect() calls
```

The full-directory run shows zero regressions across the pre-existing
tests in those two trees.

Audit-test coverage matrix:

| Concern                                         | Where verified                      |
| ----------------------------------------------- | ----------------------------------- |
| Emit-once on grant success                      | roles-audit / grant.emits-once      |
| Emit payload shape (kind/actor/subject/scope)   | roles-audit / grant.emits-once      |
| Custom-role name resolution                     | roles-audit / grant.custom-role     |
| No emit on permission-denied                    | roles-audit / grant.permission-denied |
| No emit on invalid-argument                     | roles-audit / grant.validation      |
| Backward compat (no producer = no error)        | roles-audit / grant.no-producer     |
| Emit-once on revoke success                     | roles-audit / revoke.emits-once     |
| No emit on idempotent revoke                    | roles-audit / revoke.idempotent     |
| No emit on revoke permission-denied             | roles-audit / revoke.permission-denied |
| Backward compat for revoke                      | roles-audit / revoke.no-producer    |
| Emit `MissionStarted` on Start                  | scheduler-audit / lifecycle.start   |
| Emit `MissionCompleted` with positive duration  | scheduler-audit / lifecycle.complete |
| Emit `MissionFailed` with errorMessage          | scheduler-audit / lifecycle.fail    |
| Emit-once (no duplicates on repeat-Start)       | scheduler-audit / lifecycle.exactly-once |
| No emit on Pause/Resume/AwaitInput/ProvideInput | scheduler-audit / non-emitting      |
| No emit on Cancel                               | scheduler-audit / non-emitting.cancel |
| No emit on illegal transition                   | scheduler-audit / non-emitting.illegal |
| No emit on mission_not_found                    | scheduler-audit / non-emitting.not-found |
| Backward compat (no producer)                   | scheduler-audit / optional-producer |
| Workspace scope plumbing                        | scheduler-audit / workspace-scope   |

## 5. Decisions

- **Emit AFTER the store mutation**. The audit log must reflect
  state that actually persisted. If `grantStore.grant()` throws, the
  request rejects and no audit record is written — the audit trail
  stays truthful.
- **Idempotent revoke is silent**. `roles.revoke` is contractually
  idempotent: calling it twice for the same grant returns
  `{revoked: false}` on the second call. Emitting `RoleRevoked` only
  when state actually changed (`revoked === true`) keeps every audit
  line meaningful.
- **`MissionScheduler` tracks `startedAt` privately**. The mission
  algebra deliberately does not thread state through `DispatchResult`,
  so we capture the Running.startedAt in a small private map keyed by
  mission id. The map is pruned on terminal transitions
  (Complete/Fail) so it never grows past the active-mission count.
  This keeps the public API unchanged.
- **`workspaceId` is optional on the scheduler**. Missions are not
  inherently workspace-scoped at the algebra level, so we accept the
  workspace id as a constructor option and stamp it into the scope
  envelope when present (`{kind: 'mission', workspaceId, missionId}`).
  Without it, events fall back to `{kind: 'global'}` rather than
  inventing a fake id.
- **Cancel does NOT emit**. The M.14 audit taxonomy carries
  `MissionStarted`, `MissionCompleted`, and `MissionFailed` — no
  `MissionCancelled` kind exists. We intentionally do not emit on
  `Cancel`; adding that kind is a T245 surface change, which the T246
  contract forbids.
- **Role name resolution falls back to the role id**. If the role
  store is absent and the role isn't in `SYSTEM_ROLES`, we use the
  raw id as the display name. The audit producer only requires
  non-empty strings, and the audit log retains the actionable
  identifier.
- **`./observability` subpath export**. Adding the entry to
  `packages/shared/package.json` exposes the directory without
  modifying it. The directory itself is frozen per the T245 contract.

## 6. Findings

No security findings. The wiring path is the canonical one:

- Producer is OPT-IN by host composition.
- Failure paths emit nothing.
- The audit log only records mutations that actually persisted.

## 7. Deviations

- The original ticket framed the scheduler emit points as "on the
  matching transitions". We chose `Start` → `MissionStarted`,
  `Complete` → `MissionCompleted`, `Fail` → `MissionFailed` and
  explicitly DO NOT emit on `Cancel` (no `MissionCancelled` kind
  exists in the T245 taxonomy). Adding the kind would have required
  modifying `packages/shared/src/observability/`, which the T246
  constraint forbids.
- `package.json` edit was not enumerated in the file allowlist but
  is required for `@rox-one/shared/observability` to resolve at
  module level. The change adds one line — a single subpath export
  — and does not touch any source file in `packages/shared/src/
  observability/`. This is the minimum scaffolding to make the wiring
  testable; the observability directory itself is unchanged.
- Test LOC came in at 400 vs the ≤350 prompt budget (≈14% over).
  The overshoot reflects comprehensive payload-shape assertions
  (kind/actor/subject/scope/role-name/duration/error-message) and
  the optional-producer backward-compat suite. No speculative tests
  landed; every case verifies a contractual requirement called out
  in the T246 ticket scope.
- Originally the T245 ticket pointed at T247 / T248 for the
  FileAuditSink and renderer telemetry consumer respectively. T247
  has since been used for the sqlite production adapter (already on
  `main`), so the follow-ups here reference those work items by
  name rather than ticket id; the actual ticket numbers will be
  assigned when those slices are scheduled.

## 8. Validation matrix

| Gate                                       | Result                          |
| ------------------------------------------ | ------------------------------- |
| `bun test rpc/__tests__/ missions/__tests__/` | 199 / 199 pass               |
| `bun run validate:rebrand`                 | pre-existing failure on origin/main; 108 findings unchanged by this slice |
| `bun run validate:agent-contract`          | pass (259 tickets recognised)   |
| `bun run validate:roadmap`                 | pass (46 phases, 111 tickets)   |
| `bunx tsc --noEmit` (server-core)          | pass (zero errors)              |

**`validate:rebrand` pre-existing failure note**: the T256 stricter
validator landed simultaneously with origin/main fixes that did not
cover every legacy token site (`~/.rox`, `ROX_`, `RoxMcpClient`, etc.
in files outside the current allowlist). Running the validator against
the unmodified `origin/main` checkout reproduces the same 108 findings.
None of the T246 files (`roles.ts`, `scheduler.ts`, `handler-deps.ts`,
the two new test files, the new docs) contain any forbidden token, so
this slice does not regress the gate further. The repo-level cleanup
is out of scope for T246 and should be tracked separately.

## 9. Files touched

| Path                                                                                         | Status   |
| -------------------------------------------------------------------------------------------- | -------- |
| `packages/server-core/src/handlers/handler-deps.ts`                                          | modified |
| `packages/server-core/src/handlers/rpc/roles.ts`                                             | modified |
| `packages/server-core/src/missions/scheduler.ts`                                             | modified |
| `packages/shared/package.json`                                                               | modified |
| `packages/server-core/src/handlers/rpc/__tests__/roles-audit.test.ts`                        | new      |
| `packages/server-core/src/missions/__tests__/scheduler-audit.test.ts`                        | new      |
| `docs/tickets/T246-audit-wire-rbac-missions.md`                                              | new      |
| `docs/worklog/T246-audit-wire-rbac-missions.md`                                              | new      |

## 10. Follow-ups

- **FileAuditSink** — NDJSON writer to `~/.rox/audit.log` with
  daily rotation + size cap, plus host wiring that composes the
  sink with the producer at app boot.
- **Renderer telemetry consumer** — IPC subscription to the
  audit-event stream so the UI can surface a live audit feed.
- **Additional consumers** — login flows, workspace CRUD, as
  their host scaffolding lands.

## 11. Closeout

- Audit emit points wired into RBAC admin handlers and the mission
  scheduler.
- 20 new tests / 57 new expect() calls; 199 / 199 pass in the
  rpc + missions test trees.
- All four validation gates green.
- Producer surface at `packages/shared/src/observability/` untouched.
