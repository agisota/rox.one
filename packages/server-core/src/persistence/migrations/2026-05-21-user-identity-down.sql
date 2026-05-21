-- WT-04: User + Identity data contract — DOWN migration.
-- Reverses 2026-05-21-user-identity-up.sql. Idempotent (uses IF EXISTS).
-- Drop order respects FK: identities first (depends on users).
--
-- Round-trip invariant (AC-04.2 / AC-04.3): applying up → down → up must
-- yield zero `pg_dump --schema-only` diff. The test runner asserts this.

BEGIN;

DROP INDEX IF EXISTS identities_last_seen_idx;
DROP INDEX IF EXISTS identities_user_idx;
DROP TABLE IF EXISTS identities;

DROP INDEX IF EXISTS users_tenant_status_idx;
DROP TABLE IF EXISTS users;

COMMIT;
