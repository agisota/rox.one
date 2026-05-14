# T246d worklog — composition-root wire for attachAuditProducer

## 1. Task summary

Thread the T246c `attachAuditProducer` helper into `bootstrapServer`
in `packages/server-core/src/bootstrap/headless-start.ts` so production
builds get the host audit chain wired onto `HandlerDeps.auditProducer`
automatically, and the chain disposes cleanly during shutdown. T246c
landed as an opt-in seam; T246d is the composition-root adoption
slice that closes the M.14 adoption loop.

## 2. Repo context discovered

- `packages/server-core/src/bootstrap/headless-start.ts` is the
  canonical composition root. `bootstrapServer` is exported from
  `./bootstrap/index.ts` and is called by both
  `packages/server/src/index.ts` (standalone server) and
  `apps/electron/src/main/index.ts` (Electron host). Threading the
  wire here means both hosts pick it up with no caller changes.
- `bootstrapServer` assembles `HandlerDeps` via the host-supplied
  `options.createHandlerDeps({ sessionManager, platform,
  oauthFlowStore })`. The result has the optional
  `auditProducer?: AuditProducer` slot declared by T246. That's
  where the wire writes.
- `bootstrapServer` already returns a `ServerInstance` with a
  `stop()` shutdown path that disposes `oauthFlowStore` and
  releases the server lock. The audit dispose slots in cleanly
  between those two steps.
- `packages/server-core/src/bootstrap/audit-bootstrap.ts` exports
  `attachAuditProducer`, `AttachAuditProducerOptions`,
  `AuditAttachableDeps`, and `AuditBootstrapHandle`. The helper's
  surface is exactly what the composition root needs — no shape
  changes required.
- `packages/shared/src/config/paths.ts` captures `CONFIG_DIR` at
  module-load time. For tests to drive `bootstrapServer` without
  writing the lock file to `~/.rox`, the test file sets
  `process.env.ROX_CONFIG_DIR` BEFORE the dynamic
  `import('../headless-start.ts')` call so `getConfigDir()`
  evaluates against the redirected path.

## 3. Files inspected

- `packages/server-core/src/bootstrap/headless-start.ts`
- `packages/server-core/src/bootstrap/audit-bootstrap.ts`
- `packages/server-core/src/bootstrap/index.ts`
- `packages/server-core/src/bootstrap/__tests__/audit-bootstrap.test.ts`
- `packages/server-core/src/bootstrap/__tests__/token-entropy.test.ts`
- `packages/server-core/src/observability/host.ts`
- `packages/server-core/src/observability/__tests__/host.test.ts`
- `packages/server-core/src/handlers/handler-deps.ts`
- `packages/server-core/src/transport/server.ts` (for the
  `port: 0` random-port contract)
- `packages/server-core/src/transport/types.ts`
- `packages/shared/src/config/paths.ts`
- `packages/server/src/index.ts` (call site — read-only to confirm
  no caller change is required)
- `apps/electron/src/main/index.ts` (call site — read-only, same)
- `docs/tickets/T246c-bootstrap-host-audit.md` and worklog
- `docs/tickets/T246b-fileauditsink-host.md`

## 4. Implementation

`packages/server-core/src/bootstrap/headless-start.ts` (+39 LOC):

- **Imports** (lines 12-17): pulled `attachAuditProducer`,
  `AttachAuditProducerOptions`, `AuditAttachableDeps`, and
  `AuditBootstrapHandle` from `./audit-bootstrap.ts`.
- **`ServerBootstrapOptions`** (lines 56-63): added
  `auditProducerOptions?: AttachAuditProducerOptions` so hosts can
  override `logDir` / `clock` / `retention` / `sinks` /
  `createChain` / `readDisableFlag`. Defaults flow through.
- **`ServerInstance`** (lines 83-88): added `auditHandle:
  AuditBootstrapHandle` so hosts can flush the chain manually. The
  handle is idempotent.
- **Wire call** (lines 341-349): placed after
  `options.createHandlerDeps(...)` (line 335) and **before**
  `options.registerAllRpcHandlers(...)` (line 358). This ordering
  is asserted in test #8 — handlers see `deps.auditProducer` from
  the first request.
- **Shutdown call** (lines 412-418): placed inside the existing
  `stop()` function between `oauthFlowStore.dispose()` and
  `releaseServerLock()`. Wrapped in the same `try { ... } catch
  (error) { platform.logger.error(...) }` pattern so a failed
  audit flush logs but never blocks shutdown.
- **Return** (line 396): added `auditHandle` to the
  `ServerInstance` return object.

The wire uses `options.auditProducerOptions ?? {}` so missing
options are equivalent to invoking `attachAuditProducer(deps)` with
no overrides. The default branch runs the real
`createHostAuditProducer` against `$HOME/.rox/audit.log`; the
`ROX_AUDIT_DISABLE=1` kill-switch installs the no-op producer.

## 5. Tests added

`packages/server-core/src/bootstrap/__tests__/composition-root.test.ts`
(300 LOC, 10 cases, 27 expects):

1. **Real-branch attach** — `deps.auditProducer` matches the stub
   chain producer; `instance.auditHandle.disabled` is `false`;
   `instance.auditHandle.producer` matches; `deps.registered`
   confirms `registerAllRpcHandlers` ran after the wire.
2. **`ROX_AUDIT_DISABLE='1'` no-op branch** — chain factory never
   called; `instance.auditHandle.disabled === true`;
   `deps.auditProducer === instance.auditHandle.producer`.
3. **`stop()` idempotency** — `stub.disposed === 1` after three
   calls to `instance.stop()`.
4. **Emit round-trip** — `deps.auditProducer.emit({...
   RoleGranted...})` reaches the stub chain with `correlationId`
   intact.
5. **Host-option forwarding** — `logDir`, `retention.maxAgeMs`,
   `retention.maxFiles`, and `clock` flow through
   `auditProducerOptions` to the chain factory verbatim.
6. **Manual `auditHandle.dispose()` flush** — calling
   `instance.auditHandle.dispose()` before `instance.stop()`
   increments `stub.disposed` once; subsequent `stop()` does not
   double-dispose.
7. **Defaults when `auditProducerOptions` omitted** — verified via
   the `ROX_AUDIT_DISABLE=1` env switch to stay hermetic.
8. **Producer-attached-before-register ordering** — capture
   `deps.auditProducer` from inside
   `registerAllRpcHandlers(_, d)` and confirm it matches the stub
   chain producer (the wire must run before handlers register).
9. **`stop()` swallows audit-dispose errors** — stub chain that
   throws from `dispose()` still resolves `instance.stop()` to
   `undefined`.
10. **HandlerDeps shape preservation** — deps bag with extra fields
    (`marker: 'preserved'`) survives the wire; only the
    `auditProducer` slot is mutated.

Hermeticity:
- `ROX_CONFIG_DIR` redirected to
  `${process.cwd()}/.tmp-test-composition-root/run-XXXX` **before**
  the dynamic `import('../headless-start.ts')` call. This ensures
  the lock-file write (`writeFileSync(LOCK_FILE, ...)`) lands
  inside the worktree, not `~/.rox`.
- Every test boots `bootstrapServer` on `rpcPort: 0` (OS-assigned)
  with a fresh server token, so tests are order-independent and do
  not collide on port binds.
- The chain factory is stubbed via `auditProducerOptions.createChain`
  — no real `FileAuditSink` is constructed in any test, so neither
  `~/.rox` nor `/tmp` is touched by the audit surface.
- `afterAll` removes the `.tmp-test-composition-root` tree.

## 6. Validation

- `bun test packages/server-core/src/bootstrap/__tests__/` —
  24 pass / 0 fail / 75 expects across 3 files
  (10 composition-root + 11 audit-bootstrap + 3 token-entropy).
- `bun run validate:rebrand` —
  `rebrand validation passed: no forbidden tokens outside the allowlist`.
- `bun run validate:agent-contract` —
  `ok: 11 skills, 319 tickets, 7 required docs`.
- `bun run validate:roadmap` —
  `OK — 46 phases, 110 tickets across detail files`.

Pre-existing `bunx tsc --noEmit` failures in
`packages/server-core/src/sync/__tests__/workspace-sync-multi-client-conflict.test.ts`
(4 errors) reproduce against `origin/main` without any T246d
changes applied; they are outside the T246d file set.

## 7. LOC budget

- Source: 39 LOC in `headless-start.ts` (≤80 budget).
- Tests: 300 LOC in `composition-root.test.ts` (=300 budget).
- Ticket + worklog: this slice only.

## 8. Frozen surfaces (verified untouched)

- `packages/server-core/src/bootstrap/audit-bootstrap.ts` (T246c)
- `packages/server-core/src/observability/host.ts` (T246b)
- `packages/server-core/src/observability/file-audit-sink.ts` (T248)
- `packages/server-core/src/observability/audit-retention.ts` (T249)
- `packages/shared/src/observability/**` (T245)
- All RPC handlers under `packages/server-core/src/handlers/`
- `.swarm/master-roadmap-log.md`

## 9. Follow-ups

- **Renderer audit feed (T247).** A ring-buffer sink will plug
  in via `auditProducerOptions.sinks` once the renderer IPC
  channel lands.
- **Scheduled retention sweep.** Current behaviour fires on
  rotation only; a `setInterval` sweep closes the low-traffic
  gap.
- **Hash-chain integration with the in-memory
  `AuditEventStore`.** Tamper-evident chaining remains a separate
  slice.

## 10. M.14 final closeout

T245 (producer) + T246 (RBAC/missions wire) + T248 (file sink) +
T249 (retention) + T246b (host composition) + T246c (bootstrap
helper) + T246d (composition-root adoption) complete the M.14
audit chain — taxonomy through host factory through bootstrap
seam through automatic adoption — with the audit trail live in
shipped builds by default (and `ROX_AUDIT_DISABLE=1` opts out).
