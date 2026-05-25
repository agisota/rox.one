-- WT-05 — reverse of 0001_tenant_org.up.sql.
--
-- Drops indexes before their backing tables to keep older SQLite engines
-- happy; the order is otherwise immaterial because there are no incoming
-- FKs to the tenant_org pair at this point in history.

DROP INDEX IF EXISTS ix_organizations_owner;
DROP INDEX IF EXISTS ix_organizations_tenant;
DROP TABLE IF EXISTS organizations;

DROP INDEX IF EXISTS ix_tenants_plan;
DROP INDEX IF EXISTS ux_tenants_slug_active;
DROP TABLE IF EXISTS tenants;
