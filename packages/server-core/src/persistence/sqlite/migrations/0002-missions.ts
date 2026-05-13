/**
 * Migration 0002 — durable mission state.
 *
 * Adds a single `missions` table that stores one row per mission record,
 * keyed by mission id (UUID v7). The mission state is split into a
 * `state_kind` discriminator (cheap to index for `list` filters) and a
 * `state_payload_json` blob (the variant-specific fields encoded as a
 * single JSON object — `createdAt`, `startedAt`, `at`, `reason`, etc.).
 *
 * Rationale for the column shape:
 *   - `state_kind` is indexed so `MissionStore.list({ kinds })` can use a
 *     B-tree probe instead of scanning every payload.
 *   - `state_payload_json` keeps the schema stable as new variants are
 *     added to the `MissionState` algebra — only the encoder/decoder in
 *     `sqlite-mission-store.ts` needs to learn the new shape.
 *   - `created_at` / `updated_at` are ISO-8601 strings so they sort
 *     lexicographically (UTC, fixed precision). Per the data-integrity
 *     rules, all timestamps live in UTC at rest.
 *
 * The `down()` drops the table; the migrations runner removes the ledger
 * row separately, so a `rollback(1)` returns the schema to T247's state.
 */

import { Database } from 'bun:sqlite'
import type { SqliteMigration } from '../migrations'

function applyDdl(db: Database, sql: string): void {
  // Fixed-string DDL — no user input is ever spliced into these strings.
  db.run(sql)
}

export const migration0002Missions: SqliteMigration = {
  version: 2,
  name: '0002-missions',

  up(db: Database): void {
    applyDdl(
      db,
      `CREATE TABLE missions (
        id TEXT PRIMARY KEY,
        state_kind TEXT NOT NULL,
        state_payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );`,
    )
    // Index `state_kind` for fast `list({ kinds })` filters; the scheduler
    // routinely fans out across Pending/Running rows on startup recovery.
    applyDdl(db, `CREATE INDEX idx_missions_state_kind ON missions(state_kind);`)
    // Index `updated_at` so newest-first scans and audit replays can probe
    // the B-tree directly instead of sorting the full row set.
    applyDdl(db, `CREATE INDEX idx_missions_updated_at ON missions(updated_at);`)
  },

  down(db: Database): void {
    // Indexes are dropped implicitly when the parent table is dropped.
    applyDdl(db, `DROP TABLE IF EXISTS missions;`)
  },
}
