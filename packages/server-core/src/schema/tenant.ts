/**
 * SQL bridge for WT-05 — Tenant + Organization.
 *
 * Pure schema description: file paths to the .up.sql / .down.sql artifacts
 * plus row-shape interfaces used by the persistence adapter. No SQL is
 * executed here; the runner lives at
 * `packages/server-core/src/persistence/sqlite/migrations.ts` and will be
 * wired in a follow-up WT (see WT-16 isolation-tests + WT-23 storage).
 *
 * Cross-ref:
 *   - migrations/0001_tenant_org.up.sql
 *   - migrations/0001_tenant_org.down.sql
 *   - packages/shared/src/core/tenant.ts
 *   - packages/shared/src/core/organization.ts
 */

export const TENANT_TABLE = 'tenants' as const;
export const ORGANIZATION_TABLE = 'organizations' as const;

/** Logical version number for the tenant/org migration pair. */
export const TENANT_MIGRATION_VERSION = 1 as const;

/** Filesystem-relative paths to the migration SQL files. */
export const TENANT_MIGRATION_FILES = {
  up: 'migrations/0001_tenant_org.up.sql',
  down: 'migrations/0001_tenant_org.down.sql',
} as const;

/**
 * Row shape as it sits in the `tenants` table — millisecond timestamps,
 * unquoted column names. The adapter is responsible for converting to /
 * from the ISO-8601-bearing `Tenant` contract in `@rox-one/shared/core`.
 */
export interface TenantRow {
  id: string;
  slug: string;
  name: string;
  plan: 'free' | 'pro' | 'team' | 'enterprise';
  region: 'eu' | 'us' | 'global';
  created_at_ms: number;
  updated_at_ms: number;
  deleted_at_ms: number | null;
}

/** Row shape as it sits in the `organizations` table. */
export interface OrganizationRow {
  id: string;
  tenant_id: string;
  name: string;
  owner_user_id: string;
  /** Serialized OrganizationSettings JSON. */
  settings_json: string;
  created_at_ms: number;
  deleted_at_ms: number | null;
}

/**
 * The seeded default tenant row (matches the INSERT OR IGNORE in
 * the up.sql migration). Exposed so tests can assert on it without
 * parsing the SQL file.
 */
export const SEEDED_DEFAULT_TENANT_ROW: TenantRow = {
  id: '01890000-0000-7000-8000-000000000000',
  slug: 'local',
  name: 'Local',
  plan: 'free',
  region: 'global',
  created_at_ms: 0,
  updated_at_ms: 0,
  deleted_at_ms: null,
};
