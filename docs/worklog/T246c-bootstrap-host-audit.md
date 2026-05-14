# T246c worklog — bootstrap helper for createHostAuditProducer

## 1. Task summary

Add a thin bootstrap helper, `attachAuditProducer`, that wires the
T246b `createHostAuditProducer` chain onto the `HandlerDeps`-shaped
slot consumed by the RBAC + missions RPC handlers (`roles.grant`,
`roles.revoke`, `missions.*`). The helper exposes a `dispose()` for
shutdown that proxies to the underlying chain's flush + retention +
close sequence. A `ROX_AUDIT_DISABLE=1` env switch installs a no-op
producer so tests / dev runs never touch `~/.rox/audit.log`.

This closes the M.14 adoption gap: T245 (producer interface), T246
(emit wire), T248 (file sink), T249 (retention), and T246b (host
composition) all already live on `main`. T246c is the bootstrap
seam that downstream hosts (Electron-main, server-build) can call
to light the trail up in shipped builds.

## 2. Repo context discovered

- `packages/server-core/src/observability/host.ts` (T246b) is the
  composition root. The helper is a thin adapter on top — it
  imports `createHostAuditProducer`, `CreateHostAuditProducerOptions`,
  and `HostAuditChain` verbatim.
- `packages/server-core/src/handlers/handler-deps.ts` declares
  `HandlerDeps.auditProducer?: AuditProducer` (T246). That optional
  field is what the helper mutates — no new contract is introduced
  for handlers.
- `packages/server-core/src/handlers/rpc/roles.ts` already branches
  on `deps.auditProducer && ctx.userId` before emitting
  `RoleGranted` / `RoleRevoked`. Nothing in the handler path needs
  to change for the helper to take effect.
- `packages/server-core/src/bootstrap/headless-start.ts` is the
  canonical composition root. It is **not** touched by T246c —
  adoption is intentionally additive so the helper can land on its
  own schedule.
- `@rox-one/shared/utils` exports `readEnv`, which honours both the
  canonical `ROX_*` name and the legacy `ROX_*` fallback. The
  helper uses it directly so the kill-switch follows the project's
  env-shim contract.

## 3. Files inspected

- `packages/server-core/src/observability/host.ts`
- `packages/server-core/src/observability/index.ts`
- `packages/server-core/src/observability/__tests__/host.test.ts`
- `packages/server-core/src/bootstrap/headless-start.ts`
- `packages/server-core/src/bootstrap/index.ts`
- `packages/server-core/src/bootstrap/__tests__/token-entropy.test.ts`
- `packages/server-core/src/handlers/handler-deps.ts`
- `packages/server-core/src/handlers/rpc/roles.ts` (read-only — to
  confirm no handler edits required)
- `packages/shared/src/utils/env-compat.ts`
- `packages/shared/src/observability/audit-producer.ts`
- `packages/shared/src/observability/correlation-id.ts`
- `docs/tickets/T246b-fileauditsink-host.md`
- `docs/worklog/T246b-fileauditsink-host.md`

## 4. Tests added first

`packages/server-core/src/bootstrap/__tests__/audit-bootstrap.test.ts`
(225 LOC) — 11 cases / 44 expects:

1. Real-branch attach: producer attached, host options
   (`logDir` / `clock` / `retention`) forwarded verbatim.
2. Helper-only options (`readDisableFlag`, `createChain`) stripped
   before forwarding.
3. Emit round-trip lands on the stub chain.
4. `ROX_AUDIT_DISABLE='1'` → no-op producer; factory never invoked.
5. No-op `emit` returns a fully-formed `AuditEvent`, stamping
   default `ts` + `correlationId` when caller omits them.
6. Truthy-string matrix (`'1'`, `'true'`, `'yes'`, `'on'`, `'TRUE'`)
   disables; `'0'` / `'false'` / `'FALSE'` / `''` do not.
7. `dispose()` on the real branch flushes the chain exactly once
   even when called multiple times.
8. `dispose()` on the no-op branch resolves without instantiating
   the chain.
9. `process.env.ROX_AUDIT_DISABLE` honoured when no
   `readDisableFlag` override is supplied.
10. Pre-existing `deps.auditProducer` slot is overwritten; handle
    shares the same producer reference as `deps.auditProducer`.
11. Options-less invocation defaults to the real factory (verified
    via the kill-switch to stay hermetic).

The stub chain is constructed in-test (`makeStubChain`) and exposes
a counter on `dispose` so the idempotency assertion is direct. No
real `FileAuditSink` is constructed in any test — that surface is
covered by T246b's own 18-case suite in
`packages/server-core/src/observability/__tests__/host.test.ts`.

## 5. Implementation

`packages/server-core/src/bootstrap/audit-bootstrap.ts` (152 LOC):

- `AuditAttachableDeps` — the mutable slot interface. Hosts pass
  their `HandlerDeps` (or any object exposing
  `auditProducer?: AuditProducer`).
- `AttachAuditProducerOptions` extends `CreateHostAuditProducerOptions`
  and adds two helper-only knobs:
  - `readDisableFlag?: () => string | undefined` — defaults to
    `() => readEnv('ROX_AUDIT_DISABLE')`.
  - `createChain?: (opts) => HostAuditChain` — defaults to
    `createHostAuditProducer`. Pure test seam; never called in
    production.
- `AuditBootstrapHandle` returns `{ producer, dispose, disabled }`.
- `isAuditDisabled(read)` — any non-empty string is treated as
  disabling, except literal `'0'`, `'false'`, and `'FALSE'`. This
  matches the existing repo convention (`ROX_DEBUG === '1'` etc.)
  while staying lenient about truthy aliases.
- `createNoopAuditProducer()` — returns an `AuditProducer` whose
  `emit` produces a fully-typed `AuditEvent`, stamping `ts` with
  the epoch ISO string and `correlationId` with
  `asCorrelationId('noop')` when missing. Handlers that propagate
  the returned event downstream (e.g. for logging) never see an
  undefined field.
- `attachAuditProducer` — the public entry. Short-circuits to the
  no-op branch when disabled; otherwise calls the chain factory,
  attaches the producer onto `deps.auditProducer`, and wraps
  `chain.dispose` in a once-only `dispose()`. Helper-only options
  are destructured out before forwarding.

## 6. Validation

- `bun test packages/server-core/src/bootstrap/__tests__/audit-bootstrap.test.ts`
  — 11 pass / 0 fail / 44 expects across 1 file.
- `bun run validate:rebrand` — `no forbidden tokens outside the allowlist`.
- `bun run validate:agent-contract` —
  `ok: 11 skills, 315 tickets, 7 required docs`.
- `bun run validate:roadmap` —
  `OK — 46 phases, 110 tickets across detail files`.

Pre-existing `bunx tsc --noEmit` failures in
`packages/server-core/src/sync/__tests__/workspace-sync-multi-client-conflict.test.ts`
(4 errors) reproduce against `origin/main` without any T246c changes
applied; they are outside the T246c file set.

## 7. LOC budget

- Source: 152 LOC (≤200 budget).
- Tests: 225 LOC (≤250 budget).
- Ticket + worklog: this slice only.

## 8. Frozen surfaces (verified untouched)

- `packages/shared/src/observability/**`
- `packages/server-core/src/observability/host.ts`
- `packages/server-core/src/observability/file-audit-sink.ts`
- `packages/server-core/src/observability/audit-retention.ts`
- `packages/server-core/src/bootstrap/headless-start.ts`
- All RPC handlers under `packages/server-core/src/handlers/`

## 9. Follow-ups

- `headless-start.ts` adoption (one call to `attachAuditProducer`
  after `bootstrapServer(...)` plus a `dispose()` hook in the
  shutdown path).
- Renderer audit-feed sink via `options.sinks`.
- Scheduled retention sweep so the policy still fires on
  low-traffic days where rotations never trigger.
