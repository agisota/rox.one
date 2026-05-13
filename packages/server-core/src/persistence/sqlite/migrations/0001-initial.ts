/**
 * Initial schema migration for the M.6 sqlite persistence adapter.
 *
 * Tables created:
 *   - `accounts` — one row per identity, keyed by UUID v7, unique email.
 *   - `workspaces` — owned by an account via FK with CASCADE delete.
 *   - `role_grants` — RBAC grants for an actor under a scope.
 *   - `audit_events` — append-only audit trail with JSON payload.
 *
 * Indexes:
 *   - `workspaces.account_id` for fan-out reads in `listWorkspaces`.
 *   - `role_grants.actor_id` for `getGrants` lookups.
 *   - `audit_events.subject` + `(scope_kind, scope_id)` for typical queries.
 *
 * The `down()` reverses by dropping tables in dependency order.
 */

import { Database } from 'bun:sqlite'
import type { SqliteMigration } from '../migrations'

function applyDdl(db: Database, sql: string): void {
  // Fixed-string DDL — no user input is ever spliced into these strings.
  db.run(sql)
}

export const migration0001Initial: SqliteMigration = {
  version: 1,
  name: '0001-initial',

  up(db: Database): void {
    applyDdl(
      db,
      `CREATE TABLE accounts (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL
      );`,
    )

    applyDdl(
      db,
      `CREATE TABLE workspaces (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
      );`,
    )
    applyDdl(db, `CREATE INDEX idx_workspaces_account_id ON workspaces(account_id);`)

    applyDdl(
      db,
      `CREATE TABLE role_grants (
        id TEXT PRIMARY KEY,
        actor_id TEXT NOT NULL,
        role_id TEXT NOT NULL,
        scope_kind TEXT NOT NULL,
        scope_id TEXT,
        created_at TEXT NOT NULL
      );`,
    )
    applyDdl(db, `CREATE INDEX idx_role_grants_actor_id ON role_grants(actor_id);`)
    applyDdl(
      db,
      `CREATE INDEX idx_role_grants_scope ON role_grants(scope_kind, scope_id);`,
    )

    applyDdl(
      db,
      `CREATE TABLE audit_events (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        actor TEXT NOT NULL,
        subject TEXT NOT NULL,
        scope_kind TEXT NOT NULL,
        scope_id TEXT,
        timestamp_ms INTEGER NOT NULL,
        correlation_id TEXT,
        payload_json TEXT NOT NULL
      );`,
    )
    applyDdl(db, `CREATE INDEX idx_audit_events_subject ON audit_events(subject);`)
    applyDdl(
      db,
      `CREATE INDEX idx_audit_events_scope ON audit_events(scope_kind, scope_id);`,
    )
    applyDdl(
      db,
      `CREATE INDEX idx_audit_events_timestamp ON audit_events(timestamp_ms);`,
    )
  },

  down(db: Database): void {
    // Drop in reverse dependency order. Indexes are dropped implicitly
    // with their parent table.
    applyDdl(db, `DROP TABLE IF EXISTS audit_events;`)
    applyDdl(db, `DROP TABLE IF EXISTS role_grants;`)
    applyDdl(db, `DROP TABLE IF EXISTS workspaces;`)
    applyDdl(db, `DROP TABLE IF EXISTS accounts;`)
  },
}
