# T216 - Pi IPC scope propagation

## 1. Task summary

Propagate workspace auth-scope inputs through Pi subprocess initialization so
Pi re-mints authenticated storage scope locally and rejects forged workspace
envelopes.

## 2. Repo context discovered

- The roadmap labels Phase 1.3 as `T215-pi-ipc-scope-propagation`, but `T215`
  is already occupied by `T215-c4-server-core-rpc-handlers-scope-migration`.
  This task uses `T216` as the next free ticket and preserves Phase 1.3 scope.
- `deriveScopeFromAuth()` owns branded scope minting. Branded scopes are not
  serializable and must stay process-local.
- The Pi path currently flows through `SessionManager.getOrCreateAgent()` to
  `createBackendFromResolvedContext()`, `piDriver.buildRuntime()`,
  `PiAgent.spawnSubprocess()`, and the Pi server JSONL `init` message.
- Current Pi init sends workspace and session ids, but no
  `requestedWorkspaceId`, permitted workspace list, or envelope integrity
  signal.
- The SessionManager path does not yet receive full RBAC
  `permittedWorkspaces`; Phase 2 remains responsible for producing that richer
  permission set.
- For this Phase 1.3 bridge, the parent can scope the Pi process to the managed
  workspace it is already starting and later consume Phase 2 RBAC-produced
  permission lists without changing the Pi envelope shape.

## 3. Files inspected

- `AGENTS.md`
- `docs/superpowers/goals/2026-05-13-agent-workbench-suite-master-roadmap-goal.md`
- `docs/superpowers/specs/2026-05-10-c4-multi-tenant-storage-isolation-design.md`
- `docs/superpowers/plans/2026-05-10-c4-multi-tenant-storage-isolation.md`
- `docs/tickets/T215-c4-server-core-rpc-handlers-scope-migration.md`
- `docs/worklog/T215-c4-server-core-rpc-handlers-scope-migration.md`
- `packages/shared/src/config/storage-scope-auth.ts`
- `packages/server-core/src/handlers/rpc/storage-scope.ts`
- `packages/server-core/src/sessions/SessionManager.ts`
- `packages/shared/src/agent/backend/types.ts`
- `packages/shared/src/agent/backend/factory.ts`
- `packages/shared/src/agent/backend/internal/drivers/pi.ts`
- `packages/shared/src/agent/pi-agent.ts`
- `packages/pi-agent-server/src/index.ts`
- `packages/shared/src/agent/backend/internal/drivers/pi.test.ts`
- `packages/shared/src/agent/__tests__/pi-agent-dependency-risk.test.ts`

## 4. Tests added first

- Added
  `packages/pi-agent-server/src/__tests__/storage-scope-bootstrap.test.ts`.
  It covers tenant round-trip to the same config root as parent-side
  `deriveScopeFromAuth()`, forged requested workspace rejection, and
  integrity-token mismatch rejection.
- Added `packages/shared/src/agent/__tests__/pi-agent-scope-init.test.ts`.
  It starts a temporary fake Pi JSONL server and asserts the real `PiAgent`
  init payload carries the storage-scope auth inputs plus a generated one-time
  token that matches the child environment.
- Extended `packages/shared/src/agent/backend/internal/drivers/pi.test.ts`
  with Pi runtime forwarding coverage for `storageScopeAuth`.

## 5. Expected failing test output

Initial red runs before implementation:

```text
bun test packages/pi-agent-server/src/__tests__/storage-scope-bootstrap.test.ts
error: Cannot find module '../storage-scope-bootstrap.ts'
0 pass
1 fail
1 error
```

```text
bun test packages/shared/src/agent/backend/internal/drivers/pi.test.ts
expect(runtime.storageScopeAuth).toEqual(storageScopeAuth)
Received: undefined
3 pass
1 fail
```

```text
bun test packages/shared/src/agent/__tests__/pi-agent-scope-init.test.ts
expect(captured.init.storageScopeAuth).toMatchObject(...)
Matcher error: received value must be a non-null object
0 pass
1 fail
```

## 6. Implementation changes

- Added shared backend types for IPC-safe storage-scope auth:
  `BackendStorageScopeAuth` and `PiStorageScopeAuthEnvelope`.
- Threaded `storageScopeAuth` through `CoreBackendConfig`,
  `BackendRuntimePayload`, the Pi driver, and Pi runtime construction.
- Added `buildSessionStorageScopeAuth()` in `SessionManager` so newly created
  backend sessions pass the managed workspace id as both the requested and
  permitted workspace for Phase 1.3.
- Updated `PiAgent.spawnSubprocess()` to generate a per-spawn UUID integrity
  token, pass it to the child through `ROX_PI_SCOPE_IPC_TOKEN`, and include
  the token plus auth inputs in the JSONL `init` payload.
- Added `packages/pi-agent-server/src/storage-scope-bootstrap.ts`. The helper
  validates envelope shape, verifies the one-time token before scope
  derivation, re-mints scope through `deriveScopeFromAuth()`, and records the
  resolved config root through `getConfigDirForScope()`.
- Updated Pi server `handleInit()` to call `bootstrapScope()` and keep the
  resolved storage scope for the session bootstrap.

## 7. Validation commands run

- `bun install --frozen-lockfile`
- `bun test packages/pi-agent-server/src/__tests__/storage-scope-bootstrap.test.ts`
- `bun test packages/shared/src/agent/backend/internal/drivers/pi.test.ts`
- `bun test packages/shared/src/agent/__tests__/pi-agent-scope-init.test.ts`
- `cd packages/shared && bunx tsc --noEmit`
- `cd packages/server-core && bunx tsc --noEmit`
- `cd packages/pi-agent-server && bun run build`
- `cd packages/pi-agent-server && bunx tsc --noEmit`
- `bun test packages/shared/src/config/__tests__/storage-scope-auth.test.ts packages/shared/src/config/__tests__/storage-scope.test.ts`
- `ROX_MULTI_TENANT=1 bun test packages/shared/src/agent/__tests__/pi-agent-scope-init.test.ts packages/pi-agent-server/src/__tests__/storage-scope-bootstrap.test.ts`
- `bun run validate:docs`
- `bun run validate:agent-contract`
- `git diff --check`
- `bun run typecheck`
- `bun run lint`
- `bun run build`
- `bun test`

## 8. Passing test output summary

- Pi bootstrap helper:

```text
bun test packages/pi-agent-server/src/__tests__/storage-scope-bootstrap.test.ts
3 pass
0 fail
6 expect() calls
```

- Pi driver runtime forwarding:

```text
bun test packages/shared/src/agent/backend/internal/drivers/pi.test.ts
4 pass
0 fail
8 expect() calls
```

- Real `PiAgent.spawnSubprocess()` init serialization against a fake JSONL Pi
  server:

```text
bun test packages/shared/src/agent/__tests__/pi-agent-scope-init.test.ts
1 pass
0 fail
5 expect() calls
```

- Adjacent storage-scope tests:

```text
bun test packages/shared/src/config/__tests__/storage-scope-auth.test.ts packages/shared/src/config/__tests__/storage-scope.test.ts
24 pass
0 fail
38 expect() calls
```

- Multi-tenant provider-safe smoke:

```text
ROX_MULTI_TENANT=1 bun test packages/shared/src/agent/__tests__/pi-agent-scope-init.test.ts packages/pi-agent-server/src/__tests__/storage-scope-bootstrap.test.ts
4 pass
0 fail
11 expect() calls
```

- Full suite:

```text
bun test
5063 pass
13 skip
0 fail
1 snapshots
12683 expect() calls
5076 tests
453 files
```

- Typecheck, lint, docs validation, agent-contract validation, and
  `git diff --check` completed with exit code 0.

## 9. Build output summary

- `cd packages/pi-agent-server && bun run build` completed with exit code 0
  and bundled the Pi agent server.
- `bun run build` completed with exit code 0. The build emitted the existing
  Vite large-chunk warnings, with no new build failure.
- `cd packages/pi-agent-server && bunx tsc --noEmit` is not a valid package
  gate in the current repo shape: it fails with pre-existing package-local
  TypeScript configuration/test issues, including `TS6059` for shared files
  outside `rootDir` and unrelated existing test typing errors. The package's
  actual build gate, root `bun run typecheck`, and package build all passed.

## 10. Remaining risks

- This ticket propagates a workspace-scoped envelope for the managed workspace
  that owns the Pi session. Full user/team permission expansion still belongs
  to Phase 2 RBAC.
- The provider-safe fake Pi smoke verifies the subprocess IPC contract and
  multi-tenant bootstrap path. A real provider-backed Pi manual smoke under
  `ROX_MULTI_TENANT=1` is blocked in this workspace because no real Pi provider
  credentials/configuration are available.
- `bootstrapScope(undefined)` still resolves to `DEFAULT_LOCAL_SCOPE` so older
  direct Pi bootstrap paths and single-user callers remain compatible. Managed
  server sessions now send the auth envelope through `SessionManager`.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| Pi init carries a storage-scope auth envelope | Pass | `pi-agent-scope-init.test.ts` captures the real `PiAgent` JSONL `init` payload |
| Pi side re-mints scope with `deriveScopeFromAuth()` | Pass | `storage-scope-bootstrap.test.ts` asserts Pi bootstrap uses parent-equivalent scope derivation |
| Parent and Pi resolve the same tenant config root | Pass | Tenant round-trip test compares Pi config dir with parent `getConfigDirForScope(deriveScopeFromAuth(...))` |
| Roxed cross-workspace envelopes reject | Pass | Forgery test throws `MultiTenantForgeryError` |
| Integrity-token mismatch rejects before scope derivation | Pass | Integrity test throws `PiStorageScopeIntegrityError` before permitted-workspace checks |
| Single-user runtime remains unchanged | Pass | Missing envelope falls back to `DEFAULT_LOCAL_SCOPE`; full suite and provider-safe multi-tenant smoke pass |
| Targeted tests pass | Pass | Pi bootstrap, Pi driver, PiAgent init, and adjacent storage-scope tests pass |
| Full relevant validation passes or blocker documented | Pass | Root typecheck, lint, build, full suite, docs validation, and agent-contract validation pass; real provider smoke blocker documented |
| Worklog complete | Pass | All 11 required sections filled |
| Commit created | Pass | This task is committed with the T216 changes |
