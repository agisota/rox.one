// @rox-one/test-fixtures
//
// Shared test fixtures used by tests across packages. Migrating fixture data
// out of *.test.ts files keeps individual test files focused on assertions
// and prevents the same fake/config from being re-derived in multiple places.
//
// Each fixture lives in its own module; this barrel re-exports them.
export { TEST_MODE_CONFIG, type TestModeConfig } from "./safe-mode-bash-patterns.ts";
