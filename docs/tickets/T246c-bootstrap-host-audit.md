# T246c — server-core bootstrap helper for createHostAuditProducer

Status: DONE

## Context

We are building a white-label fork of Craft Agents OSS into the
ROX.ONE Agent Workbench Suite.

T246b (PR #140) shipped `createHostAuditProducer` at
`packages/server-core/src/observability/host.ts` — the host-side
composition root that assembles `StructuredLogger + FileAuditSink +
AuditProducer + retention` and exposes `{ producer, dispose,
activeLogPath, logger, enforceRetentionNow }`.

T246b was the factory; T246c is the **bootstrap adoption slice**. It
adds a thin helper that wraps the T246b chain with a kill-switch and
attaches the producer onto the `HandlerDeps`-shaped slot used by the
RBAC + missions RPC handlers (`roles.grant`, `roles.revoke`,
`missions.*`). The canonical composition root in
`packages/server-core/src/bootstrap/headless-start.ts` stays frozen —
hosts call `attachAuditProducer(deps)` after `bootstrapServer(...)`
returns.

## Scope

1. **`packages/server-core/src/bootstrap/audit-bootstrap.ts`** (new,
   152 LOC):
   - `attachAuditProducer(deps, options?)` →
     `{ producer, dispose, disabled }`.
   - Default branch: calls `createHostAuditProducer(...)` (verbatim
     T246b factory) and writes the producer onto `deps.auditProducer`.
     `dispose()` proxies to the chain's own dispose so flush +
     retention + close all run on shutdown. Idempotent across multiple
     calls.
   - Kill-switch branch: when `readEnv('ROX_AUDIT_DISABLE')` returns
     a truthy string (`'1'`, `'true'`, `'yes'`, `'on'`, …) the helper
     installs a no-op producer instead. The host chain is never
     constructed in this branch, so `~/.rox/audit.log` is never
     touched by tests / dev runs. Handlers that probe
     `deps.auditProducer && ...` still see a producer so their
     happy-path branch fires; emit returns a fully-formed
     `AuditEvent` with default `ts` + `correlationId` so any
     downstream type assertion holds.
   - Helper-specific options (`readDisableFlag`, `createChain`) are
     stripped before forwarding to the inner factory; every other
     option flows through verbatim.

2. **`packages/server-core/src/bootstrap/__tests__/audit-bootstrap.test.ts`**
   (new, 225 LOC) — 11 cases / 44 expects covering:
   - Real-branch attach: producer wired onto deps, host options
     (`logDir`, `clock`, `retention`) forwarded.
   - Helper-specific options never leak to the inner factory.
   - Emit round-trip through the attached producer reaches the stub.
   - `ROX_AUDIT_DISABLE='1'` → no-op producer, factory never called.
   - No-op `emit` stamps default `ts` + `correlationId` and echoes
     caller-supplied fields.
   - Truthy-string matrix (`'1'`, `'true'`, `'yes'`, `'on'`, `'TRUE'`)
     disables; explicit `'0'` / `'false'` / `''` does not.
   - `dispose()` is idempotent on both branches.
   - No-op `dispose()` resolves without instantiating the chain.
   - `process.env.ROX_AUDIT_DISABLE` honoured when no override
     supplied.
   - Pre-existing `deps.auditProducer` slot is overwritten and the
     handle shares the same producer reference.
   - Options-less invocation defaults to the real factory (verified
     via the kill-switch path to stay hermetic).

## Out of scope

- Modifying the canonical bootstrap composition root in
  `headless-start.ts`. Adoption is intentionally additive — hosts
  call `attachAuditProducer` after `bootstrapServer(...)` returns.
- Wiring `attachAuditProducer` into the Electron-main and
  server-build entry points. The helper is the seam; the
  call-site adoption is a follow-up slice so this lands
  independently.
- Renderer audit feed (T247).
- Scheduled retention sweep (`setInterval`).
- Hash-chain integration with the in-memory `AuditEventStore`.

## Rules followed

- T245/T246/T246b/T248/T249 surfaces imported verbatim; no
  modifications to `packages/shared/src/observability/`,
  `packages/server-core/src/observability/host.ts`,
  `file-audit-sink.ts`, or `audit-retention.ts`.
- `headless-start.ts` untouched.
- No RPC handler modified — the producer plumbs via the existing
  optional `deps.auditProducer` slot already declared in T246.
- Source LOC: 152 (≤200 budget). Test LOC: 225 (≤250 budget).
- Files touched: helper + tests + ticket + worklog only.
- No new external dependencies — pulls only from existing
  `@rox-one/shared/observability`, `@rox-one/shared/utils`, and the
  T246b host factory.

## Validation gates

- `bun test packages/server-core/src/bootstrap/__tests__/audit-bootstrap.test.ts`
  — 11 pass / 0 fail / 44 expects.
- `bun run validate:rebrand` — pass.
- `bun run validate:agent-contract` — pass.
- `bun run validate:roadmap` — pass.

Pre-existing `bunx tsc --noEmit` failures in
`packages/server-core/src/sync/__tests__/workspace-sync-multi-client-conflict.test.ts`
are reproducible against `origin/main` and outside the T246c file set.

## Follow-ups

- **Adoption inside `bootstrapServer`.** Once the call-site contract
  is fixed (a single `attachAuditProducer(deps, { logSink })` call
  in `headless-start.ts` plus a `dispose()` hook in the shutdown
  path), the producer is live in shipped builds. The helper makes
  that follow-up a 5-line change.
- **Renderer audit feed.** A ring-buffer sink can be passed via
  `options.sinks` once the renderer IPC channel lands.

## M.14 closeout (with T246c)

T245 (producer) + T246 (RBAC/missions wire) + T248 (file sink) +
T249 (retention) + T246b (host composition) + T246c (bootstrap
helper) now form the full M.14 chain — taxonomy through host
factory through bootstrap seam — with a single-call adoption path
for downstream hosts. Renderer audit feed (T247) and tamper-
evident hash chain integration remain as separate slices.
