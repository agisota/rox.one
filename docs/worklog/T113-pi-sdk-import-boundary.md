# T113 - PI SDK Import Boundary Worklog

## 1. Task summary

Keep PI SDK model-discovery code out of the broad shared config barrel so public
server/runtime imports of `@rox-agent/shared/config` do not transitively load
`@mariozechner/pi-ai` before a PI-specific, guarded code path is selected.

Initial state:

```text
## mac/rox-production-ready-rc...origin/mac/rox-production-ready-rc [ahead 15]
```

## 2. Repo context discovered

- `packages/shared/src/config/index.ts` exports `./models-pi.ts`.
- `models-pi.ts` imports `@mariozechner/pi-ai` at module scope.
- Many server-core files import generic config APIs from
  `@rox-agent/shared/config`.
- The PI-specific consumers found in this slice are:
  - `apps/electron/src/main/index.ts`
  - `packages/server-core/src/handlers/rpc/llm-connections.ts`
- `packages/shared/package.json` does not yet expose a dedicated
  `./config/models-pi` subpath.

## 3. Tests added first

Added `scripts/__tests__/pi-sdk-import-boundary-contract.test.ts` before
implementation. The test requires:

- the broad config barrel does not export `models-pi`;
- the shared package exposes `@rox-agent/shared/config/models-pi`;
- Electron main imports PI model discovery from the deep subpath;
- server-core PI discovery dynamic imports use the deep subpath rather than the
  broad config barrel.

Red command:

```bash
bun test scripts/__tests__/pi-sdk-import-boundary-contract.test.ts
```

## 4. Expected failing test output

Initial red run before changing the import boundary:

```text
0 pass
2 fail
2 expect() calls

Expected to not contain: "export * from './models-pi.ts'"
Received: "export * from './types.ts'; ... export * from './models-pi.ts'; ..."

Expected to contain: "from '@rox-agent/shared/config/models-pi'"
Received: apps/electron/src/main/index.ts still imports
getPiModelsForAuthProvider/getAllPiModels from '@rox-agent/shared/config'
```

After the first deep-import patch, I strengthened the contract to require
server-core PI SDK discovery imports to remain behind public exposure guards.
That red run failed as expected:

```text
2 pass
1 fail
9 expect() calls

Expected providersGuard to be greater than providersHandler
Received: -1
```

## 5. Implementation changes

- Removed `export * from './models-pi.ts'` from
  `packages/shared/src/config/index.ts`.
- Added the explicit package export
  `@rox-agent/shared/config/models-pi`.
- Updated Electron main's PI model resolver to import
  `getPiModelsForAuthProvider` and `getAllPiModels` from the deep models-pi
  subpath.
- Updated server-core PI provider discovery handlers to:
  - run `validatePublicProviderSdkAccess()` before importing the PI SDK-backed
    models-pi module;
  - return an empty provider list for public-untrusted API key provider
    discovery;
  - return `undefined` for public-untrusted provider base URL discovery;
  - dynamically import only `@rox-agent/shared/config/models-pi` after the
    guard passes.
- Updated dependency and accepted-risk release evidence so T113 is listed with
  the current local guards.

## 6. Validation commands run

```bash
bun test scripts/__tests__/pi-sdk-import-boundary-contract.test.ts
bun test scripts/__tests__/dependency-risk-register-contract.test.ts
bun test packages/server-core/src/domain/connection-setup-logic.test.ts
cd packages/server-core && bun run typecheck
bun run typecheck:shared
cd apps/electron && bun run typecheck
cd packages/shared && bun run test src/agent/__tests__/pi-agent-dependency-risk.test.ts src/agent/backend/internal/drivers/pi.test.ts
bun run validate:docs
git diff --check
git diff --name-only | rg '(^|/)(bun\.lock|bun\.lockb|pnpm-lock\.yaml|package-lock\.json|yarn\.lock)$' || true
```

Additional probe:

```bash
cd packages/shared && bun run typecheck
```

Result: failed because `packages/shared/package.json` has no `typecheck`
script. The repo-native root script `bun run typecheck:shared` was used instead
and passed.

## 7. Passing test output summary

PI SDK import-boundary contract:

```text
3 pass
0 fail
15 expect() calls
```

Dependency risk register contract:

```text
2 pass
0 fail
35 expect() calls
```

Server-core connection setup domain test:

```text
25 pass
0 fail
46 expect() calls
```

Shared PI dependency-risk and internal driver tests:

```text
5 pass
0 fail
5 expect() calls
```

Typechecks:

```text
cd packages/server-core && bun run typecheck: pass
bun run typecheck:shared: pass
cd apps/electron && bun run typecheck: pass
```

Docs validation:

```text
[agent-contract] ok: 11 skills, 114 tickets, 7 required docs
[architecture-docs] ok: 4 docs, 10 subsystem headings
[sync-v2-design] validated docs/architecture/sync-v2-design.md
```

Diff and lockfile hygiene:

```text
git diff --check: pass
lockfile diff check: no output
```

## 8. Remaining risks

- This ticket prevents broad config imports from loading the PI SDK model
  discovery module and guards static server-core PI discovery handlers in
  public-untrusted mode. It does not upgrade vulnerable PI SDK transitive
  dependencies.
- Direct PI runtime use still requires dependency remediation, production
  isolation evidence, or signed accepted-risk approval before public
  production.

## 9. Acceptance criteria matrix

| Criteria | Status | Evidence |
|---|---|---|
| Import-boundary test fails before implementation and passes after | Done | Red runs failed on config barrel/Electron import and missing server-core discovery guards; green contract test passes |
| `@rox-agent/shared/config` no longer exports `models-pi` | Done | Static contract plus config barrel diff |
| `@rox-agent/shared/config/models-pi` is exported explicitly | Done | Static contract plus `packages/shared/package.json` export |
| Electron main PI resolver imports models-pi through the deep subpath | Done | Static contract plus Electron main diff |
| Server-core PI discovery dynamic imports use the deep subpath after the public guard | Done | Static contract plus handler diff and server-core typecheck |
| Dependency risk evidence references T113 | Done | Dependency and accepted-risk register docs plus contract test |
| Lockfiles remain unchanged | Done | Lockfile diff check returned no output |
| Docs validation passes | Done | `bun run validate:docs` |
| Worklog complete | Done | This file |
| Scoped Lore commit exists | Done | This commit |
