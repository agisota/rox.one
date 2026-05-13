# T221 - Audit event retention policy

## 1. Task summary

Add explicit audit retention policy evaluation with verifiable retained hash
chains.

## 2. Repo context discovered

- The audit storage backend remains append-only by design; retention must not
  add update/delete methods to `AuditEventStorageBackend`.
- `verifyAuditHashChain` validates canonical record fields and can validate a
  retained set if retained records are re-anchored and re-hashed.
- T221 is scoped to `packages/server-core/src/audit/audit-event-store.ts` plus
  the existing audit store test file.

## 3. Files inspected

- `AGENTS.md`
- `docs/superpowers/specs/2026-05-16-audit-storage-backend-design.md`
- `docs/superpowers/plans/2026-05-16-audit-storage-backend.md`
- `docs/decision-records/audit-harness/0008-audit-storage-backend.md`
- `packages/server-core/src/audit/audit-event-store.ts`
- `packages/server-core/src/audit/__tests__/audit-event-store.test.ts`

## 4. Tests added first

Extended `packages/server-core/src/audit/__tests__/audit-event-store.test.ts`
with `applies per-event retention rules and re-anchors the retained hash
chain` before adding production code.

The test proves:

- A 30-day `scope.factory.downgraded` rule removes only an expired matching
  record.
- A 90-day `credential.scope.write` rule keeps the same-age credential record.
- The retained set is re-anchored from the initial audit hash.
- Retained records carry metadata for original and re-anchored linkage.
- `verifyAuditHashChain(retained.records)` passes while the original store
  remains unchanged and verifiable.

## 5. Expected failing test output

Red run:

- Command: `bun test packages/server-core/src/audit/__tests__/audit-event-store.test.ts`
- Result: exit 1.
- Expected failure: `SyntaxError: Export named 'applyAuditRetentionPolicy' not
  found in module .../packages/server-core/src/audit/audit-event-store.ts`.

The failure showed the new test was exercising a missing retention API, not an
unrelated runtime failure.

## 6. Implementation changes

- Added explicit `AuditRetentionPolicy`, `AuditRetentionRule`,
  `AuditRetentionMetadata`, `RetainedAuditEventRecord`, and
  `AuditRetentionResult` types.
- Added `applyAuditRetentionPolicy(records, policy)` as a side-effect-free
  evaluator that returns retained records plus removed record copies.
- Preserved append-only storage semantics by avoiding update/delete APIs on
  `AuditEventStorageBackend`.
- Re-anchored retained records from `INITIAL_AUDIT_EVENT_HASH` and recomputed
  hashes with the canonical audit hash field set.
- Preserved original linkage through retention metadata so rotation can be
  audited later without mutating the original event stream.

## 7. Validation commands run

- `bun test packages/server-core/src/audit/__tests__/audit-event-store.test.ts`
- `cd packages/server-core && bunx tsc --noEmit`
- `bun run typecheck`
- `bun run lint`
- `bun run validate:agent-contract`
- `bun run validate:docs`
- `git diff --check`
- `bun test`
- `bun run build`

## 8. Passing test output summary

- Targeted audit store test: 6 pass, 0 fail, 26 `expect()` calls.
- Server-core TypeScript check: exit 0.
- Workspace typecheck: exit 0.
- Lint: exit 0.
- Agent contract validation: exit 0.
- Docs validation: exit 0.
- Whitespace check: exit 0.
- Full test suite: 5078 pass, 13 skip, 0 fail, 1 snapshot, 12747 `expect()`
  calls, 5091 tests across 456 files in 68.82s.

## 9. Build output summary

`bun run build` completed with exit 0. The build still prints existing Vite
large chunk warnings; T221 did not add new bundling dependencies or frontend
runtime paths.

## 10. Remaining risks

- T221 returns a retained record set but does not schedule or persist backend
  rotation. A runtime retention job would need its own ticket.
- Production sqlite/s3 retention persistence remains reserved for a later
  storage-backend implementation slice.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| Per-event-type `retention_days` removes only expired matching records | Green | Targeted retention test removes only `req-expired` |
| Retained records keep non-expired and longer-retention event types | Green | Targeted retention test keeps `req-kept-longer` and `req-recent` |
| Retained records carry re-anchoring metadata | Green | Targeted retention test asserts original and re-anchored hash metadata |
| `verifyAuditHashChain(retainedRecords)` passes after retention | Green | Targeted retention test verifies retained hash chain |
| The storage backend remains append-only with no update/delete API | Green | Retention is a pure exported function over record arrays |
| Targeted retention tests pass | Green | 6 pass, 0 fail |
| Full relevant validation passes or blocker documented | Green | Typecheck, lint, docs, full test suite, and build passed |
| Worklog complete | Green | All 11 sections complete |
| Commit created | Green | T221 committed with Lore protocol |
