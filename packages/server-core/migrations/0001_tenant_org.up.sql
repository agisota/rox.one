-- WT-05 — Tenant + Organization base schema.
--
-- Companion .down.sql performs a clean reverse.
-- Mirrored in `packages/shared/src/core/tenant.ts` and
--             `packages/shared/src/core/organization.ts`.
--
-- Conventions (cross-ref CLAUDE.md User Engineering Rules):
--   - UUID v7 stored as TEXT (canonical 36-char form).
--   - `*_at_ms` columns are UTC milliseconds since epoch — display layer
--     converts to local time. The TypeScript layer carries ISO-8601 strings
--     instead; the bridge in @rox-one/server-core/schema/tenant maps both.
--   - Soft-delete via `deleted_at_ms`; downstream queries MUST filter
--     `deleted_at_ms IS NULL` by default (ADR A05-03).

CREATE TABLE IF NOT EXISTS tenants (
  id              TEXT PRIMARY KEY NOT NULL,
  slug            TEXT NOT NULL,
  name            TEXT NOT NULL,
  plan            TEXT NOT NULL DEFAULT 'free'
                    CHECK (plan IN ('free', 'pro', 'team', 'enterprise')),
  region          TEXT NOT NULL DEFAULT 'global'
                    CHECK (region IN ('eu', 'us', 'global')),
  created_at_ms   INTEGER NOT NULL,
  updated_at_ms   INTEGER NOT NULL,
  deleted_at_ms   INTEGER
);

-- Slug uniqueness applies only to active (non-soft-deleted) rows; a
-- previously-used slug can be re-claimed after the holder is soft-deleted.
CREATE UNIQUE INDEX IF NOT EXISTS ux_tenants_slug_active
  ON tenants(slug)
  WHERE deleted_at_ms IS NULL;

CREATE INDEX IF NOT EXISTS ix_tenants_plan
  ON tenants(plan)
  WHERE deleted_at_ms IS NULL;

CREATE TABLE IF NOT EXISTS organizations (
  id                 TEXT PRIMARY KEY NOT NULL,
  tenant_id          TEXT NOT NULL,
  name               TEXT NOT NULL,
  owner_user_id      TEXT NOT NULL,
  settings_json      TEXT NOT NULL DEFAULT '{}',
  created_at_ms      INTEGER NOT NULL,
  deleted_at_ms      INTEGER,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS ix_organizations_tenant
  ON organizations(tenant_id)
  WHERE deleted_at_ms IS NULL;

CREATE INDEX IF NOT EXISTS ix_organizations_owner
  ON organizations(owner_user_id)
  WHERE deleted_at_ms IS NULL;

-- Seed the default tenant so single-tenant installs work without any
-- bootstrap step. The id matches DEFAULT_TENANT_ID exported from
-- @rox-one/shared/core/tenant-defaults.
INSERT OR IGNORE INTO tenants (
  id, slug, name, plan, region, created_at_ms, updated_at_ms
) VALUES (
  '01890000-0000-7000-8000-000000000000',
  'local',
  'Local',
  'free',
  'global',
  0,
  0
);
