# T219 - Audit event writer

## 1. Task summary

Wire existing C4 audit emitters into the queryable audit backend while
preserving their structured logger output.

## 2. Repo context discovered

- T218 placed the audit schema under server-core, but C4 emitters live in
  `packages/shared`, so T219 needs a shared audit writer surface.
- `packages/shared/src/utils/debug.ts` owns existing debug output.
- `storage-scope-auth.ts`, `storage-internal.ts`, and
  `credentials/backends/secure-storage.ts` emit the C4/T217 audit events that
  must become queryable.

## 3. Files inspected

- `AGENTS.md`
- `docs/superpowers/goals/2026-05-13-agent-workbench-suite-master-roadmap-goal.md`
- `docs/superpowers/specs/2026-05-16-audit-storage-backend-design.md`
- `docs/superpowers/plans/2026-05-16-audit-storage-backend.md`
- `docs/decision-records/audit-harness/0008-audit-storage-backend.md`
- `packages/shared/src/utils/debug.ts`
- `packages/shared/src/config/storage-scope-auth.ts`
- `packages/shared/src/config/storage-internal.ts`
- `packages/shared/src/credentials/backends/secure-storage.ts`
- `packages/server-core/src/audit/audit-event-store.ts`

## 4. Tests added first

- Added `packages/shared/src/audit/__tests__/audit-event-writer.test.ts`
  before implementation.
- Covered memory fanout for `scope.factory.downgraded` while preserving
  existing debug output.
- Covered persistence without `CRAFT_DEBUG` by forcing
  `scope.brand.cast_breach` through the storage runtime guard.
- Covered file backend JSONL persistence and redaction under
  `<configDir>/audit/events.jsonl`.

## 5. Expected failing test output

- First red run:
  `bun test packages/shared/src/audit/__tests__/audit-event-writer.test.ts`
  failed with `Cannot find module '../index.ts'`.
- After tightening the debug-disabled persistence assertion, the targeted test
  failed with `Export named '__setDebugEnabledForTests' not found in
  .../packages/shared/src/utils/debug.ts`.

## 6. Implementation changes

- Added `packages/shared/src/audit/audit-event-store.ts` with the append-only
  audit schema, redaction, hash-chain verification, `InMemoryAuditEventStore`,
  and `FileAuditEventStore`.
- Added `packages/shared/src/audit/audit-event-writer.ts` with
  `ROX_AUDIT_BACKEND=memory|file` fanout, explicit reserved failures for
  `sqlite|s3`, structured payload mapping, and test flush/reset helpers.
- Added `packages/shared/src/audit/index.ts` and exported it from
  `packages/shared/package.json`.
- Updated C4 scope emitters in `storage-scope-auth.ts` and
  `storage-internal.ts` to append structured audit events before preserving
  existing logger output.
- Updated tenant credential scope emitters to append
  `credential.scope.*` events through the same writer.
- Added `__setDebugEnabledForTests` to `debug.ts` so persistence can be tested
  independently from debug output.
- Changed `packages/server-core/src/audit/audit-event-store.ts` to re-export
  shared audit contracts, avoiding a shared-to-server-core dependency.

## 7. Validation commands run

- `bun test packages/shared/src/audit/__tests__/audit-event-writer.test.ts packages/server-core/src/audit/__tests__/audit-event-store.test.ts packages/shared/src/config/__tests__/storage-scope-auth.test.ts packages/shared/src/config/__tests__/storage-scope.test.ts packages/shared/src/credentials/__tests__/tenant-key-derivation.test.ts`
- `cd packages/server-core && bunx tsc --noEmit`
- `bun run typecheck`
- `bun run lint`
- `bun run validate:docs`
- `git diff --check`
- `bun test`
- `bun run build`

## 8. Passing test output summary

- Targeted audit/scope/credential suite: 36 pass, 0 fail, 82 expect calls.
- `cd packages/server-core && bunx tsc --noEmit`: exit 0.
- `bun run typecheck`: exit 0.
- `bun run lint`: exit 0.
- `bun run validate:docs`: exit 0.
- `git diff --check`: exit 0.
- Full `bun test`: 5075 pass, 13 skip, 0 fail, 1 snapshot, 12727 expect
  calls, 5088 tests across 456 files in 69.58s.

## 9. Build output summary

- `bun run build`: exit 0. Existing Vite large-chunk warnings remained, with
  no build failure.

## 10. Remaining risks

- T219 wires memory/file writer fanout only. Query API filters and retention
  remain T220/T221.
- `sqlite` and `s3` are reserved by name and fail closed until a dedicated
  persistence ticket implements and validates them.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| Shared audit writer exists with no shared -> server-core dependency | Pass | Shared audit exports live in `packages/shared/src/audit`; server-core re-exports them |
| Existing scope logger output still emits | Pass | Targeted writer test captures `scope.factory.downgraded` on stderr |
| `scope.*` events append to configured memory backend | Pass | Targeted writer test reads the memory store and verifies hash chain |
| Persistent append works without `CRAFT_DEBUG` | Pass | Targeted writer test disables debug and still records `scope.brand.cast_breach` |
| File backend writes redacted JSONL records under `<configDir>/audit` | Pass | Targeted writer test verifies `audit/events.jsonl` exists and secrets are redacted |
| Credential scope events use the same writer | Pass | Targeted credential scope validation included in the combined suite |
| Targeted writer tests pass | Pass | 36 pass, 0 fail in the combined targeted suite |
| Full relevant validation passes or blocker documented | Pass | typecheck, lint, docs validation, full test suite, and build exited 0 |
| Worklog complete | Pass | This 11-section worklog is complete |
| Commit created | Pass | This atomic T219 Lore commit records the change |
