/**
 * SQL definitions for the WT-07 feature-flag persistence layer.
 *
 * The runtime resolution (registry + entitlement + quota) lives in
 * `packages/shared/src/feature-flags/`. This module exposes the SQL DDL so
 * that the SQLite migration runner (`packages/server-core/src/persistence/
 * sqlite/migrations`) and the foundational raw-SQL migration files
 * (`packages/server-core/migrations/0003_feature_flags.*.sql`) stay in sync.
 *
 * Schema:
 *   - `feature_flag_overrides` — per-tenant entitlement rows
 *   - `quota_accounts`         — usage counters
 *
 * Columns mirror the Zod schemas in shared:
 *   - All timestamps are ISO-8601 in UTC ("YYYY-MM-DDTHH:mm:ss[.sss]") so
 *     they sort lexicographically.
 *   - `value_json` is a JSON-encoded scalar (boolean | number | string) so
 *     downstream readers can rebuild the polymorphic value without an extra
 *     `kind` column.
 *
 * Spec: docs/superpowers/specs/2026-05-21-wt-07-entitlement-flags-design.md
 */

export const FEATURE_FLAG_OVERRIDES_TABLE = 'feature_flag_overrides';
export const QUOTA_ACCOUNTS_TABLE = 'quota_accounts';

/** DDL for the per-tenant entitlement overrides. */
export const CREATE_FEATURE_FLAG_OVERRIDES_SQL = `
CREATE TABLE ${FEATURE_FLAG_OVERRIDES_TABLE} (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL,
  feature_key TEXT NOT NULL,
  value_json  TEXT NOT NULL,
  source      TEXT NOT NULL CHECK (source IN ('default','plan-pack','tenant-override','admin-grant')),
  expires_at  TEXT,
  created_at  TEXT NOT NULL
);
`.trim();

export const CREATE_FEATURE_FLAG_OVERRIDES_INDEXES_SQL = [
  `CREATE INDEX idx_${FEATURE_FLAG_OVERRIDES_TABLE}_tenant_feature ON ${FEATURE_FLAG_OVERRIDES_TABLE}(tenant_id, feature_key);`,
  `CREATE INDEX idx_${FEATURE_FLAG_OVERRIDES_TABLE}_expires_at ON ${FEATURE_FLAG_OVERRIDES_TABLE}(expires_at);`,
];

/** DDL for the runtime usage counters. */
export const CREATE_QUOTA_ACCOUNTS_SQL = `
CREATE TABLE ${QUOTA_ACCOUNTS_TABLE} (
  id            TEXT PRIMARY KEY,
  scope_kind    TEXT NOT NULL CHECK (scope_kind IN ('tenant','user','workspace')),
  scope_id      TEXT NOT NULL,
  resource      TEXT NOT NULL,
  used          INTEGER NOT NULL CHECK (used >= 0),
  "limit"       INTEGER NOT NULL CHECK ("limit" >= 0),
  period        TEXT NOT NULL CHECK (period IN ('minute','hour','day','month','lifetime')),
  period_start  TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  UNIQUE (scope_kind, scope_id, resource)
);
`.trim();

export const CREATE_QUOTA_ACCOUNTS_INDEXES_SQL = [
  `CREATE INDEX idx_${QUOTA_ACCOUNTS_TABLE}_scope ON ${QUOTA_ACCOUNTS_TABLE}(scope_kind, scope_id);`,
  `CREATE INDEX idx_${QUOTA_ACCOUNTS_TABLE}_resource ON ${QUOTA_ACCOUNTS_TABLE}(resource);`,
];

export const DROP_FEATURE_FLAG_OVERRIDES_SQL = `DROP TABLE IF EXISTS ${FEATURE_FLAG_OVERRIDES_TABLE};`;
export const DROP_QUOTA_ACCOUNTS_SQL = `DROP TABLE IF EXISTS ${QUOTA_ACCOUNTS_TABLE};`;

/** Convenience: full up-migration as one concatenated SQL string. */
export function buildUpSql(): string {
  return [
    CREATE_FEATURE_FLAG_OVERRIDES_SQL,
    ...CREATE_FEATURE_FLAG_OVERRIDES_INDEXES_SQL,
    CREATE_QUOTA_ACCOUNTS_SQL,
    ...CREATE_QUOTA_ACCOUNTS_INDEXES_SQL,
  ].join('\n');
}

/** Convenience: full down-migration as one concatenated SQL string. */
export function buildDownSql(): string {
  return [DROP_QUOTA_ACCOUNTS_SQL, DROP_FEATURE_FLAG_OVERRIDES_SQL].join('\n');
}
