# T246d — wire attachAuditProducer into server-core composition root

Status: DONE

## Context

We are building a white-label fork of Craft Agents OSS into the
ROX.ONE Agent Workbench Suite.

T246c (PR #186) shipped `attachAuditProducer` at
`packages/server-core/src/bootstrap/audit-bootstrap.ts` — the thin
bootstrap helper that wraps the T246b host audit chain
(`createHostAuditProducer`) with a `ROX_AUDIT_DISABLE` kill-switch
and attaches the producer onto the `HandlerDeps`-shaped slot. T246c
landed as an opt-in seam: hosts had to call `attachAuditProducer`
manually after `bootstrapServer(...)` returned.

T246d is the **composition-root adoption slice**. It threads the
helper into `bootstrapServer` in `headless-start.ts` so production
builds (Electron + standalone server) get a real audit producer
wired onto `HandlerDeps.auditProducer` automatically, and the host
audit chain disposes cleanly during shutdown.

This closes the M.14 adoption loop: the trail is now live in
shipped builds whenever `ROX_AUDIT_DISABLE` is unset.

## Scope

1. **`packages/server-core/src/bootstrap/headless-start.ts`** (+39 LOC):
   - Import `attachAuditProducer`, `AttachAuditProducerOptions`,
     `AuditAttachableDeps`, `AuditBootstrapHandle` from the T246c
     helper module.
   - Add `ServerBootstrapOptions.auditProducerOptions?:
     AttachAuditProducerOptions` so hosts can override `logDir`,
     `clock`, `retention`, sinks, or inject `createChain` for tests.
     Defaults flow through to `attachAuditProducer` verbatim.
   - Add `ServerInstance.auditHandle: AuditBootstrapHandle` so hosts
     can flush the chain manually if needed. The handle is
     idempotent across multiple dispose calls.
   - Call `attachAuditProducer(deps, options.auditProducerOptions ??
     {})` **after** `deps = options.createHandlerDeps(...)` and
     **before** `options.registerAllRpcHandlers(...)`. This ordering
     is asserted in test #8 so RBAC + mission handlers see a live
     `deps.auditProducer` from the first request.
   - Call `await auditHandle.dispose()` from `stop()` between
     `oauthFlowStore.dispose()` and `releaseServerLock()`, wrapped in
     the same `try { ... } catch (error) { platform.logger.error(...)
     }` pattern used for the other dispose calls so a failed audit
     flush never blocks shutdown.

2. **`packages/server-core/src/bootstrap/__tests__/composition-root.test.ts`**
   (new, 300 LOC) — 10 cases / 27 expects covering:
   - Real-branch attach: `deps.auditProducer` set to the stub
     chain producer, `instance.auditHandle.disabled === false`,
     `instance.auditHandle.producer` matches.
   - `ROX_AUDIT_DISABLE='1'` → no-op producer, chain factory never
     called.
   - `stop()` disposes the chain exactly once even when called
     repeatedly.
   - Emit round-trip via `deps.auditProducer.emit(...)` reaches the
     stub chain with the correlation id intact.
   - Host options (`logDir`, `retention`, `clock`) forwarded
     verbatim through `auditProducerOptions` to the chain factory.
   - Manual `instance.auditHandle.dispose()` works; subsequent
     `stop()` does not double-dispose.
   - Defaults flow through when `auditProducerOptions` is omitted
     (verified via the `ROX_AUDIT_DISABLE=1` env switch to stay
     hermetic).
   - Producer attached BEFORE `registerAllRpcHandlers` fires
     (handler-visibility ordering invariant).
   - `stop()` swallows audit-dispose errors and still resolves.
   - HandlerDeps shape preserved — only the optional
     `auditProducer` slot is mutated; other deps fields survive.

3. **Ticket + worklog** (this slice).

## Out of scope

- Modifying the T246c helper (`audit-bootstrap.ts`), the T246b
  host factory (`observability/host.ts`), the T248 file sink
  (`file-audit-sink.ts`), or the T249 retention surface
  (`audit-retention.ts`). All frozen.
- Adopting the wire inside any specific call-site host
  (Electron main / standalone server). Those hosts already call
  `bootstrapServer` and will pick up the wire automatically — the
  helper's kill-switch keeps the chain off for dev runs by default
  unless they opt in via env or `auditProducerOptions`.
- Renderer audit feed (T247) and tamper-evident hash-chain
  integration with the in-memory `AuditEventStore`.
- Scheduled retention sweep — still triggered on rotation only.

## Rules followed

- T246b/T246c/T248/T249 surfaces imported verbatim.
- No RPC handler modified — the producer plumbs via the existing
  optional `deps.auditProducer` slot already declared in T246.
- Source LOC: 39 (≤80 budget). Test LOC: 300 (=300 budget). Net
  +339 across two files.
- Files touched: composition root + new test + ticket + worklog
  only.
- No new external dependencies.

## Validation gates

- `bun test packages/server-core/src/bootstrap/__tests__/` — 24 pass
  / 0 fail / 75 expects across 3 files (10 new in composition-root,
  11 in audit-bootstrap, 3 in token-entropy).
- `bun run validate:rebrand` — pass.
- `bun run validate:agent-contract` — pass (11 skills, 319 tickets,
  7 required docs).
- `bun run validate:roadmap` — pass (46 phases, 110 tickets across
  detail files).

Pre-existing `bunx tsc --noEmit` failures in
`packages/server-core/src/sync/__tests__/workspace-sync-multi-client-conflict.test.ts`
(4 errors) reproduce against `origin/main` and are outside the T246d
file set.

## Follow-ups

- **Renderer audit feed (T247).** A ring-buffer sink can be passed
  via `auditProducerOptions.sinks` once the renderer IPC channel
  lands.
- **Scheduled retention sweep.** Currently the policy only fires on
  rotation; a periodic sweep will close the gap on low-traffic
  days.
- **Hash-chain integration with the in-memory `AuditEventStore`.**
  Tamper-evident chaining is still a separate slice.

## M.14 final closeout (with T246d)

T245 (producer interface) + T246 (RBAC/missions emit wire) + T248
(file sink) + T249 (retention) + T246b (host composition) + T246c
(bootstrap helper) + T246d (composition-root adoption) now form
the complete M.14 chain — taxonomy through host factory through
bootstrap seam through automatic adoption — with the audit trail
live in shipped builds whenever `ROX_AUDIT_DISABLE` is unset.
Renderer audit feed (T247) and tamper-evident hash chain remain as
separate slices.
