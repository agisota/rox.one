-- Down-migration for 0003_feature_flags.up.sql.
-- Indexes drop implicitly with their parent table.

DROP TABLE IF EXISTS quota_accounts;
DROP TABLE IF EXISTS feature_flag_overrides;
