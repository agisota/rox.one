# T208 - C4 final validation

## 1. Task summary

Run the full C4 stopping-condition validation and record evidence.

## 2. Repo context discovered

- T202 through T207 landed the brand/factory/runtime, resolver, submodule enforcement, caller migration, RPC demo, integration test, and ADR documentation.
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

## 4. Tests added first

No new tests are added in this validation ticket. Earlier tickets added the required C4 tests before implementation.

## 5. Expected failing test output

None expected at ticket start. Final validation exposed one in-scope C4 test-isolation failure:

- `bun test --concurrent packages/server-core/src/handlers/rpc/__tests__/workspace-scope.test.ts packages/shared/src/config/__tests__/storage-scope-runtime.test.ts packages/shared/src/config/__tests__/storage-scope-auth.test.ts packages/shared/src/config/__tests__/storage-scope.test.ts`
- Failure: the RPC test expected `['FLAT']`/`['W42']` but received `[]` because the test mutated process-global `ROX_CONFIG_DIR` while other config tests were running concurrently.

The full suite also exposed out-of-scope failures:

- `scripts/__tests__/mac-liquid-glass-icon-contract.test.ts`: stale icon sources are newer than `Assets.car`.
- `apps/electron/src/renderer/components/app-shell/__tests__/transport-connection-banner.test.ts`: tests expect English strings while implementation returns Russian copy.
- `packages/shared/src/agent/backend/__tests__/factory.test.ts`: three entries failed only in the full suite, but the file passes standalone and passes alongside all C4 tests.

## 6. Implementation changes

- Hardened `packages/server-core/src/handlers/rpc/__tests__/workspace-scope.test.ts` so each scenario runs the demo RPC handler in a child `bun run` process with its own `ROX_CONFIG_DIR` and C4 scenario env.
- Kept the test focused on the same handler wiring and outcomes while removing shared parent-process env/runtime override races.
- Did not edit out-of-scope mac icon assets, renderer banner copy/tests, or backend factory tests.

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
- `bun run build`

## 8. Passing test output summary

- `storage-scope-auth.test.ts`: 13 pass, 0 fail, 23 expects.
- `storage-scope-runtime.test.ts`: 6 pass, 0 fail, 15 expects.
- `workspace-scope.test.ts`: 5 pass, 0 fail, 5 expects.
- `storage-scope.test.ts`: 10 pass, 0 fail, 13 expects.
- C4 concurrent reproduction after hardening: 34 pass, 0 fail, 56 expects.
- `bun run typecheck`: passed.
- `bun run lint`: passed.
- `git diff --check`: passed.
- `packages/shared/src/agent/backend/__tests__/factory.test.ts`: 36 pass, 1 skip, 0 fail standalone.
- Backend factory plus C4 concurrent run: 70 pass, 1 skip, 0 fail.
- `bun test` after C4 hardening: C4 failures cleared; remaining result was 4993 pass, 13 skip, 6 fail, 12582 expects.

## 9. Build output summary

`bun run build` passed. Electron main, preload, renderer, resources, and asset copy completed successfully.

## 10. Remaining risks

- Final stopping condition is blocked because full `bun test` is not green.
- The stable out-of-scope failures are `scripts/__tests__/mac-liquid-glass-icon-contract.test.ts` stale `Assets.car` and `apps/electron/src/renderer/components/app-shell/__tests__/transport-connection-banner.test.ts` English-vs-Russian copy expectations.
- Fixing either would require modifying files outside the C4 component list, so this ticket stops instead of expanding scope.
- Three backend factory failures appeared in the full suite but pass standalone and pass in a concurrent run with all C4 tests; no C4 regression was reproduced there.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| Targeted C4 tests pass | Pass | 13/6/5/10 targeted test counts above |
| C4 RPC test is isolated from concurrent config tests | Pass | 34 pass, 0 fail in concurrent reproduction |
| `bun run typecheck` passes | Pass | Command exited 0 |
| `bun run lint` passes | Pass | Command exited 0 |
| Full `bun test` passes | Blocked | 4993 pass, 13 skip, 6 out-of-scope failures |
| `bun run build` passes | Pass | Command exited 0 |
| Worklogs and tickets complete | Pass | T202-T208 reviewed/updated |
| No unrelated runtime files modified | Pass | Git status shows only C4 RPC test plus T208 docs, with `.omx/` untracked |
| Commit created | Pass | This ticket commit |
