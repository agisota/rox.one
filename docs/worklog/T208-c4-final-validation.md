# T208 - C4 final validation

## 1. Task summary

Run the full C4 stopping-condition validation and record evidence.

## 2. Repo context discovered

- T202 through T207 landed the brand/factory/runtime, resolver, submodule enforcement, caller migration, RPC demo, integration test, and ADR documentation.
- T209 through T212 closed deterministic validation blockers found while finishing the C4 matrix: checkout mtime skew, localized banner assertions, duplicate module-brand registry behavior, and shared-config mocks that leaked an unbranded local scope into the full Bun graph.
- `.omx/` remains an untracked local workflow artifact and is not part of the repository diff.

## 3. Files inspected

- `docs/tickets/T202-c4-runtime-auth-scope-brand.md`
- `docs/worklog/T202-c4-runtime-auth-scope-brand.md`
- `docs/tickets/T203-c4-storage-scope-resolver.md`
- `docs/worklog/T203-c4-storage-scope-resolver.md`
- `docs/tickets/T204-c4-storage-submodule-scope-enforcement.md`
- `docs/worklog/T204-c4-storage-submodule-scope-enforcement.md`
- `docs/tickets/T205-c4-explicit-local-scope-caller-migration.md`
- `docs/worklog/T205-c4-explicit-local-scope-caller-migration.md`
- `docs/tickets/T206-c4-workspace-rpc-demo-scope.md`
- `docs/worklog/T206-c4-workspace-rpc-demo-scope.md`
- `docs/tickets/T207-c4-storage-isolation-adr.md`
- `docs/worklog/T207-c4-storage-isolation-adr.md`
- `packages/server-core/src/handlers/rpc/__tests__/workspace-scope.test.ts`
- `scripts/__tests__/mac-liquid-glass-icon-contract.test.ts`
- `packages/shared/src/agent/backend/__tests__/factory.test.ts`
- `apps/electron/src/renderer/components/app-shell/__tests__/transport-connection-banner.test.ts`
- `docs/tickets/T209-liquid-glass-checkout-mtime-skew.md`
- `docs/worklog/T209-liquid-glass-checkout-mtime-skew.md`
- `docs/tickets/T210-transport-banner-i18n-test-determinism.md`
- `docs/worklog/T210-transport-banner-i18n-test-determinism.md`
- `docs/tickets/T211-storage-scope-brand-registry-dedup.md`
- `docs/worklog/T211-storage-scope-brand-registry-dedup.md`
- `docs/tickets/T212-shared-config-mock-branded-local-scope.md`
- `docs/worklog/T212-shared-config-mock-branded-local-scope.md`
- `apps/electron/src/main/handlers/__tests__/settings-default-thinking.test.ts`
- `apps/electron/src/main/__tests__/session-branch-rollback.isolated.ts`

## 4. Tests added first

No new tests are added in this validation ticket. Earlier tickets added the required C4 tests before implementation.

## 5. Expected failing test output

None expected at ticket start. Final validation exposed one in-scope C4 test-isolation failure:

- `bun test --concurrent packages/server-core/src/handlers/rpc/__tests__/workspace-scope.test.ts packages/shared/src/config/__tests__/storage-scope-runtime.test.ts packages/shared/src/config/__tests__/storage-scope-auth.test.ts packages/shared/src/config/__tests__/storage-scope.test.ts`
- Failure: the RPC test expected `['FLAT']`/`['W42']` but received `[]` because the test mutated process-global `ROX_CONFIG_DIR` while other config tests were running concurrently.

The first full-suite pass also exposed deterministic non-C4 validation failures:

- `scripts/__tests__/mac-liquid-glass-icon-contract.test.ts`: checkout mtime made icon sources newer than `Assets.car`.
- `apps/electron/src/renderer/components/app-shell/__tests__/transport-connection-banner.test.ts`: tests asserted English strings while the current implementation returns Russian copy.
- `packages/shared/src/agent/backend/__tests__/factory.test.ts`: full-graph module/mock interaction passed an unbranded local-scope literal from an Electron shared-config mock into storage internals.

Each follow-up was documented in its own ticket and fixed with focused test/runtime harness changes before rerunning the C4 matrix.

## 6. Implementation changes

- Hardened `packages/server-core/src/handlers/rpc/__tests__/workspace-scope.test.ts` so each scenario runs the demo RPC handler in a child `bun run` process with its own `ROX_CONFIG_DIR` and C4 scenario env.
- Kept the test focused on the same handler wiring and outcomes while removing shared parent-process env/runtime override races.
- Did not edit out-of-scope mac icon assets, renderer banner copy/tests, or backend factory tests.
- Updated the final validation record after T209 through T212 made the full suite green.

## 7. Validation commands run

- `bun test packages/shared/src/config/__tests__/storage-scope-auth.test.ts`
- `bun test packages/shared/src/config/__tests__/storage-scope-runtime.test.ts`
- `bun test packages/server-core/src/handlers/rpc/__tests__/workspace-scope.test.ts`
- `bun test packages/shared/src/config/__tests__/storage-scope.test.ts`
- `bun test --concurrent packages/server-core/src/handlers/rpc/__tests__/workspace-scope.test.ts packages/shared/src/config/__tests__/storage-scope-runtime.test.ts packages/shared/src/config/__tests__/storage-scope-auth.test.ts packages/shared/src/config/__tests__/storage-scope.test.ts`
- `bun run typecheck`
- `bun run lint`
- `git diff --check`
- `bun test`
- `bun test scripts/__tests__/mac-liquid-glass-icon-contract.test.ts`
- `bun test packages/shared/src/agent/backend/__tests__/factory.test.ts`
- `bun test apps/electron/src/renderer/components/app-shell/__tests__/transport-connection-banner.test.ts`
- `bun test --concurrent packages/shared/src/agent/backend/__tests__/factory.test.ts packages/shared/src/config/__tests__/storage-scope-runtime.test.ts packages/shared/src/config/__tests__/storage-scope-auth.test.ts packages/shared/src/config/__tests__/storage-scope.test.ts packages/server-core/src/handlers/rpc/__tests__/workspace-scope.test.ts`
- `bun test apps/electron/src/main/handlers/__tests__/settings-default-thinking.test.ts packages/shared/src/agent/backend/__tests__/factory.test.ts`
- `bun test ./apps/electron/src/main/__tests__/session-branch-rollback.isolated.ts`
- `bun test --bail`
- `bun test packages/shared/src/config/__tests__/storage-scope-auth.test.ts packages/shared/src/config/__tests__/storage-scope-runtime.test.ts packages/server-core/src/handlers/rpc/__tests__/workspace-scope.test.ts packages/shared/src/config/__tests__/storage-scope.test.ts`
- `bun run build`

## 8. Passing test output summary

- `storage-scope-auth.test.ts`: 13 pass, 0 fail, 23 expects.
- `storage-scope-runtime.test.ts`: 6 pass, 0 fail, 15 expects.
- `workspace-scope.test.ts`: 5 pass, 0 fail, 5 expects.
- `storage-scope.test.ts`: 10 pass, 0 fail, 13 expects.
- C4 concurrent reproduction after hardening: 34 pass, 0 fail, 56 expects.
- Final targeted C4 test group: 35 pass, 0 fail, 58 expects.
- `bun run typecheck`: passed.
- `bun run lint`: passed; raw IPC send allowlist remained at 6 known sites.
- `git diff --check`: passed.
- `packages/shared/src/agent/backend/__tests__/factory.test.ts`: 36 pass, 1 skip, 0 fail standalone.
- Backend factory plus C4 concurrent run: 70 pass, 1 skip, 0 fail.
- Targeted settings handler plus backend factory after branded mock fix: 39 pass, 1 skip, 0 fail, 57 expects.
- Isolated session branch rollback after branded mock fix: 3 pass, 0 fail, 13 expects.
- Full `bun test --bail` after branded mock fix: 5000 pass, 13 skip, 0 fail, 1 snapshot, 12595 expects.
- Full `bun test`: 5000 pass, 13 skip, 0 fail, 1 snapshot, 12595 expects across 449 files.

## 9. Build output summary

`bun run build` passed. Electron main, preload, renderer, resources, and asset copy completed successfully.

## 10. Remaining risks

- `.omx/` is still untracked local workflow state and must stay out of commits.
- No known C4 validation blocker remains.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| Targeted C4 tests pass | Pass | 13/6/5/10 targeted test counts above |
| C4 RPC test is isolated from concurrent config tests | Pass | 34 pass, 0 fail in concurrent reproduction |
| `bun run typecheck` passes | Pass | Command exited 0 |
| `bun run lint` passes | Pass | Command exited 0 |
| Full `bun test` passes | Pass | 5000 pass, 13 skip, 0 fail |
| `bun run build` passes | Pass | Command exited 0 |
| Worklogs and tickets complete | Pass | T202-T212 reviewed; each worklog has 11 numbered sections |
| No unrelated runtime files modified | Pass | Final tracked tree clean; only `.omx/` untracked |
| Commit created | Pass | Final closeout commit for this ticket |
