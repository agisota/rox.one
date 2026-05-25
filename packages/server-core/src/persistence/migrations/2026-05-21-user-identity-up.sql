-- WT-04: User + Identity data contract — UP migration.
-- Spec: docs/superpowers/specs/2026-05-21-wt-04-contract-user-identity-design.md
-- Target: Postgres 16+. UUID v7 generated in application layer (no native
-- v7 helper until PG17). All timestamps are TIMESTAMPTZ in UTC.
--
-- Tables created:
--   users         — identity owner (one human, one row)
--   identities    — federated provider link (many-to-one → users)
--
-- Indexes are chosen to support tenant-scoped reads on the hot Auth path:
--   - users(tenant_id, email) — UNIQUE, primary lookup
--   - users(tenant_id, status) WHERE deleted_at_utc IS NULL — list filter
--   - identities(user_id) WHERE deleted_at_utc IS NULL — link enumeration
--   - identities(tenant_id, provider, external_id) — UNIQUE, login lookup
--   - identities(last_seen_at_utc DESC NULLS LAST) — recent-activity sort
--
-- Reversal: see 2026-05-21-user-identity-down.sql (round-trip CI-tested).

BEGIN;

CREATE TABLE IF NOT EXISTS users (
  id              UUID PRIMARY KEY,
  tenant_id       UUID NOT NULL,
  email           TEXT NOT NULL,
  username        TEXT,
  display_name    TEXT NOT NULL,
  locale          TEXT NOT NULL DEFAULT 'en-US',
  timezone        TEXT NOT NULL DEFAULT 'UTC',
  status          TEXT NOT NULL
                  CHECK (status IN ('active', 'invited', 'suspended', 'deleted')),
  created_at_utc  TIMESTAMPTZ NOT NULL,
  updated_at_utc  TIMESTAMPTZ NOT NULL,
  deleted_at_utc  TIMESTAMPTZ,
  CONSTRAINT users_email_per_tenant_uq UNIQUE (tenant_id, email)
);

CREATE INDEX IF NOT EXISTS users_tenant_status_idx
  ON users (tenant_id, status)
  WHERE deleted_at_utc IS NULL;

CREATE TABLE IF NOT EXISTS identities (
  id                UUID PRIMARY KEY,
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  tenant_id         UUID NOT NULL,
  provider          TEXT NOT NULL
                    CHECK (provider IN (
                      'google', 'slack', 'microsoft',
                      'anthropic-oauth', 'scim', 'rox-local'
                    )),
  external_id       TEXT NOT NULL,
  claims            JSONB NOT NULL DEFAULT '{}'::jsonb,
  primary_flag      BOOLEAN NOT NULL DEFAULT FALSE,
  last_seen_at_utc  TIMESTAMPTZ,
  created_at_utc    TIMESTAMPTZ NOT NULL,
  deleted_at_utc    TIMESTAMPTZ,
  CONSTRAINT identities_provider_external_per_tenant_uq
    UNIQUE (tenant_id, provider, external_id),
  CONSTRAINT identities_claims_size_chk
    CHECK (length(claims::text) <= 16384)
);

CREATE INDEX IF NOT EXISTS identities_user_idx
  ON identities (user_id)
  WHERE deleted_at_utc IS NULL;

CREATE INDEX IF NOT EXISTS identities_last_seen_idx
  ON identities (last_seen_at_utc DESC NULLS LAST);

COMMIT;
