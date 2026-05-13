# T246 - Wire AuditProducer into RBAC admin handlers + mission scheduler

Status: DONE

## Context

We are building a white-label fork of ROX.ONE OSS into the
ROX.ONE Agent Workbench Suite.

T245 (already on `main`) shipped the `AuditProducer` producer surface
at `packages/shared/src/observability/`. T246 is the first consumer
slice — wiring two specific call sites that mutate authorisation-
relevant state so the audit log reflects real operator actions:

1. **RBAC admin handlers** at
   `packages/server-core/src/handlers/rpc/roles.ts` — emit
   `RoleGranted` on `roles.grant` success and `RoleRevoked` on
   `roles.revoke` success (idempotent no-op does NOT emit).
2. **Mission scheduler** at
   `packages/server-core/src/missions/scheduler.ts` — emit
   `MissionStarted` / `MissionCompleted` / `MissionFailed` on the
   matching successful state transitions.

The producer is wired as an optional dependency: hosts that have not
yet adopted observability omit the field, emission becomes a hot
no-op, and behaviour matches the pre-T246 baseline exactly.

## Scope

Source changes (≤200 LOC):

1. `packages/server-core/src/handlers/handler-deps.ts` — add
   `auditProducer?: AuditProducer` to the dependency bag.
2. `packages/server-core/src/handlers/rpc/roles.ts` — emit
   `RoleGranted` on `roles.grant` success path; emit `RoleRevoked`
   on `roles.revoke` when `revoked === true` (no emit on the
   idempotent no-op so the audit log stays meaningful). Includes two
   small helpers: `grantScopeToAuditScope` (maps `RoleGrant` scope
   onto the canonical `AuditScope`) and `resolveRoleName` (resolves
   a human-readable role name from `SYSTEM_ROLES` or the role store).
3. `packages/server-core/src/missions/scheduler.ts` — add optional
   `auditProducer` and `workspaceId` constructor options. Emit on
   `Start` → `MissionStarted`, `Complete` → `MissionCompleted`
   (with computed `durationMs`), `Fail` → `MissionFailed`. Track
   `Running.startedAt` in a per-mission map so duration is exact;
   prune on terminal transitions so the map never grows past the
   active-mission count.
4. `packages/shared/package.json` — expose the
   `./observability` subpath export (the directory and its source
   files remain frozen per the T245 contract; only the package.json
   wiring is added so `@rox-one/shared/observability` resolves).

Test changes (≤350 LOC):

5. `packages/server-core/src/handlers/rpc/__tests__/roles-audit.test.ts`
   — 10 tests / 33 expect() calls covering grant + revoke emit-once
   on success, no-emit on permission-denied / validation-error /
   idempotent-revoke, and backward-compat when the producer is
   omitted.
6. `packages/server-core/src/missions/__tests__/scheduler-audit.test.ts`
   — 10 tests / 24 expect() calls covering `MissionStarted` /
   `MissionCompleted` (with positive `durationMs`) / `MissionFailed`
   (with `errorMessage`), illegal/terminal/non-emitting transitions
   (`Pause`, `Resume`, `AwaitInput`, `ProvideInput`, `Cancel`),
   backward-compat, and workspace-scope plumbing.

## Out of scope

- Adding new audit-event kinds (frozen by T245; the consumer side
  only emits what the taxonomy already declares).
- A real `AuditSink` implementation. A `FileAuditSink` (NDJSON to
  `~/.rox/audit.log` with rotation) will land in a follow-up slice.
- Renderer telemetry consumer.
- Other consumers (login flows, workspace lifecycle). They will land
  in their own slices once their host wiring is unblocked.

## Rules followed

- `auditProducer` is OPTIONAL everywhere — hosts that have not
  adopted observability work unchanged.
- No new external dep.
- Emission happens AFTER the store mutation returns, so a failed
  write leaves no spurious audit record.
- `roles.revoke` only emits when `revoked === true` (the idempotent
  no-op produces nothing — keeps the audit log meaningful).
- `MissionScheduler` does NOT emit on illegal transitions,
  `mission_not_found`, or non-lifecycle events (`Pause`, `Resume`,
  `AwaitInput`, `ProvideInput`, `Cancel`).
- Producer surface at `packages/shared/src/observability/` is
  untouched — T246 only consumes it.
- No `any`.

## Validation gates

- `bun test packages/server-core/src/handlers/rpc/__tests__/
  packages/server-core/src/missions/__tests__/` — 199 / 199 pass
  (20 new audit tests + 179 pre-existing).
- `bun run validate:rebrand` — pass.
- `bun run validate:agent-contract` — pass.
- `bun run validate:roadmap` — pass.

## Follow-ups

- **FileAuditSink** — newline-delimited JSON writer for
  `~/.rox/audit.log` with daily rotation + size cap, plus host
  wiring that composes the sink with the producer at app boot.
- **Renderer telemetry consumer** — subscribes to the audit-event
  stream via IPC.
- **Additional consumers** — login flows, workspace CRUD, etc.,
  as their host scaffolding lands.
