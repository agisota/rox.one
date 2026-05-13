# Queryable Audit Storage Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Phase 1.5 queryable audit storage backend progressively across T218-T221.

**Architecture:** Start with a backend-neutral append-only audit schema in server-core, then wire structured audit events into it, expose filtered queries, and add retention/rotation. The existing structured logger output remains active throughout the migration.

**Tech Stack:** TypeScript, Bun tests, Node built-in crypto, existing server-core webui/persistence seams.

---

## File Structure

- Create `packages/server-core/src/audit/audit-event-store.ts` for the normalized audit record, backend interface, in-memory implementation, sanitizer, and hash-chain verifier.
- Create `packages/server-core/src/audit/index.ts` for package-local exports.
- Create `packages/server-core/src/audit/__tests__/audit-event-store.test.ts` for T218 schema tests.
- Modify `packages/server-core/package.json` to expose the audit contract.
- Modify `packages/server-core/src/index.ts` to export the audit module.
- Later T219-T221 tasks will modify structured logger fanout, webui query routes, and retention policy modules after their own red tests.

## Task 1: T218 Audit Storage Schema

**Files:**
- Create: `docs/tickets/T218-audit-storage-schema.md`
- Create: `docs/worklog/T218-audit-storage-schema.md`
- Create: `docs/decision-records/audit-harness/0008-audit-storage-backend.md`
- Create: `packages/server-core/src/audit/__tests__/audit-event-store.test.ts`
- Create: `packages/server-core/src/audit/audit-event-store.ts`
- Create: `packages/server-core/src/audit/index.ts`
- Modify: `packages/server-core/package.json`
- Modify: `packages/server-core/src/index.ts`

- [x] **Step 1: Write the failing schema tests**

```bash
bun test packages/server-core/src/audit/__tests__/audit-event-store.test.ts
```

Expected before implementation: module import fails because the audit store
does not exist yet.

- [x] **Step 2: Implement the minimal schema module**

Create the in-memory append-only backend and hash-chain verifier using only
Node built-ins.

- [x] **Step 3: Run targeted validation**

```bash
bun test packages/server-core/src/audit/__tests__/audit-event-store.test.ts
cd packages/server-core && bunx tsc --noEmit
```

Expected: targeted tests pass and server-core typecheck passes.

- [x] **Step 4: Run relevant repository validation**

```bash
bun run typecheck
bun run lint
bun run validate:agent-contract
bun run validate:docs
git diff --check
```

Expected: all exit 0.

- [x] **Step 5: Commit T218**

Commit only T218 files with the Lore protocol and OmX co-author trailer.

## Task 2: T219 Audit Event Writer

**Files:**
- Create: `docs/tickets/T219-audit-event-writer.md`
- Create: `docs/worklog/T219-audit-event-writer.md`
- Modify: `packages/shared/src/utils/debug.ts`
- Modify: `packages/shared/src/config/storage-scope-auth.ts`
- Modify: `packages/shared/src/config/storage-internal.ts`
- Modify: `packages/server-core/src/audit/audit-event-store.ts`
- Test: `packages/shared/src/config/__tests__/storage-scope-auth.test.ts`
- Test: `packages/shared/src/config/__tests__/storage-scope.test.ts`

- [ ] **Step 1: Write failing writer tests**

Prove a `scope.*` structured logger event still emits through debug output and
also appends to the configured audit store.

- [ ] **Step 2: Implement writer fanout**

Add configurable fanout for `ROX_AUDIT_BACKEND=memory|file|sqlite|s3`, with
memory active for tests and unsupported backends failing closed until their
own persistence tickets are implemented.

- [ ] **Step 3: Validate**

Run the targeted scope/audit tests, typecheck, lint, docs validation, full
suite, and build.

## Task 3: T220 Audit Event Query API

**Files:**
- Create: `docs/tickets/T220-audit-event-query-api.md`
- Create: `docs/worklog/T220-audit-event-query-api.md`
- Modify: `packages/server-core/src/audit/audit-event-store.ts`
- Modify: `packages/server-core/src/webui/http-server.ts`
- Test: `packages/server-core/src/webui/__tests__/account-http.test.ts`
- Test: `packages/server-core/src/audit/__tests__/audit-event-store.test.ts`

- [ ] **Step 1: Write failing query tests**

Prove filters for tenant, actor, event type, and time range return only matching
events and preserve redaction.

- [ ] **Step 2: Implement query filters**

Add query options behind the audit backend and wire the existing admin/team
audit HTTP surface to consume them without changing authorization rules.

- [ ] **Step 3: Validate**

Run audit/webui targeted tests, server-core typecheck, repository typecheck,
lint, full suite, and build.

## Task 4: T221 Audit Event Retention Policy

**Files:**
- Create: `docs/tickets/T221-audit-event-retention-policy.md`
- Create: `docs/worklog/T221-audit-event-retention-policy.md`
- Modify: `packages/server-core/src/audit/audit-event-store.ts`
- Test: `packages/server-core/src/audit/__tests__/audit-event-store.test.ts`

- [ ] **Step 1: Write failing retention tests**

Prove per-event-type `retention_days` removes only expired records and leaves a
verifiable retained hash chain.

- [ ] **Step 2: Implement retention**

Add explicit retention policy evaluation and chain re-anchoring metadata for
retained records.

- [ ] **Step 3: Validate**

Run targeted audit tests, typecheck, lint, full suite, build, and docs checks.

## Self-Review

- Spec coverage: T218 covers schema, append-only behavior, defensive copies,
  sanitization, and hash-chain verification. T219 covers writer fanout. T220
  covers query filters and admin API. T221 covers retention.
- Placeholder scan: no `TBD` or undefined future code names are present.
- Type consistency: the plan uses `AuditEventRecord`, `AuditEventInput`,
  `AuditEventStorageBackend`, and `InMemoryAuditEventStore` consistently.
