# T247 - SQLite-backed production persistence adapter

Status: DONE
Phase: M.6

## Context

Phase M.6 of the master roadmap introduces a production-grade persistence
seam for the ROX.ONE Agent Workbench Suite. The existing
`createInMemoryAgentWorkbenchPersistenceAdapter` is sufficient for the
desktop in-memory tier and for unit tests, but the managed cloud tier
requires a durable single-file store that survives process restarts.

T247 lands the first durable adapter: `SqliteAdapter`, built on
`bun:sqlite` (no new runtime dependency — already part of the Bun
runtime). T266 will wire handlers against the new contract; T267 will
add backup / restore tooling.

## Goal

A self-contained `packages/server-core/src/persistence/sqlite/` module
that:

- Opens a sqlite database with WAL, `foreign_keys=ON`, and a sensible
  `busy_timeout`.
- Runs versioned, reversible migrations against a `schema_migrations`
  ledger.
- Implements a minimal `PersistenceAdapter` interface
  (`getAccount`, `putAccount`, `listWorkspaces`, `putWorkspace`,
  `getGrants`, `putGrant`, `appendAuditEvent`).
- Provides a hand-rolled UUID v7 generator (time-sortable, B-tree
  friendly) for IDs.

## Required UI

None — this is a storage seam.

## Required Data/API

Tables in the initial migration:

- `accounts(id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL)`
- `workspaces(id TEXT PRIMARY KEY, account_id TEXT NOT NULL FK→accounts ON DELETE CASCADE, name TEXT NOT NULL, created_at TEXT NOT NULL)`
- `role_grants(id TEXT PRIMARY KEY, actor_id TEXT NOT NULL, role_id TEXT NOT NULL, scope_kind TEXT NOT NULL, scope_id TEXT, created_at TEXT NOT NULL)`
- `audit_events(id TEXT PRIMARY KEY, kind TEXT NOT NULL, actor TEXT NOT NULL, subject TEXT NOT NULL, scope_kind TEXT NOT NULL, scope_id TEXT, timestamp_ms INTEGER NOT NULL, correlation_id TEXT, payload_json TEXT NOT NULL)`

Indexes:
- `idx_workspaces_account_id`
- `idx_role_grants_actor_id`
- `idx_role_grants_scope (scope_kind, scope_id)`
- `idx_audit_events_subject`
- `idx_audit_events_scope (scope_kind, scope_id)`
- `idx_audit_events_timestamp`

## Required Automations

None at this layer. T266 will wire migrations into server bootstrap.

## TDD Requirements

Write the test suite first. Cover:

1. Migration up + down round-trip (no application tables linger after
   rollback; ledger row is removed).
2. CRUD on every table (accounts, workspaces, role_grants, audit_events).
3. Connection close hygiene (idempotent close, throws on use-after-close).
4. Pragma assertions (WAL on disk, memory on `:memory:`, foreign_keys ON).
5. FK CASCADE behavior (deleting an account removes its workspaces).
6. Unique constraint enforcement (duplicate emails fail).
7. UUID v7 layout (regex + lexical monotonicity).

Confirm ≥40 `expect()` calls before considering the ticket green.

## Implementation Requirements

- Use prepared statements for all writes (no string interpolation of
  caller-provided values).
- Serialize `audit_events.payload` to JSON; reject non-object payloads
  defensively.
- Wrap each migration in a transaction together with the ledger insert
  (no partial application).
- `:memory:` paths must skip the WAL pragma.
- All IDs are UUID v7 strings (hand-rolled — Bun's `crypto.randomUUID`
  is v4).
- No `any` in source. Strict generics on row shapes.

## Validation Commands

- `bun test packages/server-core/src/persistence/sqlite/__tests__/`
- `bun run validate:rebrand`
- `bun run validate:agent-contract`
- `bun run validate:roadmap`
- `cd packages/server-core && bun run typecheck`

## Acceptance Criteria

- [x] `openSqliteAdapter` opens a DB with WAL + foreign_keys + busy_timeout.
- [x] `runMigrations` is idempotent and atomic per migration.
- [x] `rollback(0)` reverses the initial migration.
- [x] `SqliteAdapter` implements every method on `PersistenceAdapter`.
- [x] UUID v7 generator produces RFC 9562-shaped IDs sorted by time.
- [x] ≥40 expect() calls across the test suite.
- [x] Source ≤700 LOC, migrations ≤250 LOC.
- [x] `bun run typecheck` (server-core) is green.
- [x] `bun run validate:rebrand` is green.

## Worklog

Update `docs/worklog/T247-sqlite-production-persistence.md`.
