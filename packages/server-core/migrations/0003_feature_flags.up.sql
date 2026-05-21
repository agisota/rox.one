-- Migration 0003 — Feature-flag overrides + quota accounts.
-- Owned by WT-07. Down-migration reverses every change in this file.
--
-- Tables:
--   feature_flag_overrides — per-tenant entitlement rows
--   quota_accounts         — runtime usage counters
--
-- All timestamps are naive UTC ISO-8601 strings so they sort
-- lexicographically and round-trip cleanly through the Zod schemas in
-- packages/shared/src/feature-flags/.

CREATE TABLE feature_flag_overrides (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL,
  feature_key TEXT NOT NULL,
  value_json  TEXT NOT NULL,
  source      TEXT NOT NULL CHECK (source IN ('default','plan-pack','tenant-override','admin-grant')),
  expires_at  TEXT,
  created_at  TEXT NOT NULL
);

CREATE INDEX idx_feature_flag_overrides_tenant_feature
  ON feature_flag_overrides(tenant_id, feature_key);
CREATE INDEX idx_feature_flag_overrides_expires_at
  ON feature_flag_overrides(expires_at);

CREATE TABLE quota_accounts (
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

CREATE INDEX idx_quota_accounts_scope ON quota_accounts(scope_kind, scope_id);
CREATE INDEX idx_quota_accounts_resource ON quota_accounts(resource);
