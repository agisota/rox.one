# T114 - PI Driver Lazy Model Registry Worklog

## 1. Task summary

Remove the PI SDK-backed model registry from the internal PI backend driver's
module scope while preserving existing PI model-fetch and lightweight
test-connection behavior.

Initial state:

```text
## mac/rox-production-ready-rc...origin/mac/rox-production-ready-rc [ahead 16]
```

## 2. Repo context discovered

- T113 removed `models-pi.ts` from `@craft-agent/shared/config`.
- `packages/shared/src/agent/backend/factory.ts` imports `piDriver` at module
  scope for provider dispatch.
- `packages/shared/src/agent/backend/internal/drivers/pi.ts` still imports
  `getAllPiModels`, `getPiModelsForAuthProvider`, and `getPiProviderBaseUrl`
  from `models-pi.ts` at module scope.
- `models-pi.ts` imports `@mariozechner/pi-ai` at module scope.

## 3. Tests added first

Extended `scripts/__tests__/pi-sdk-import-boundary-contract.test.ts` before
implementation. The new assertion requires the PI backend driver not to import
`models-pi.ts` at module scope and to use local dynamic imports instead.

Red command:

```bash
bun test scripts/__tests__/pi-sdk-import-boundary-contract.test.ts
```

## 4. Expected failing test output

Initial red run before changing the PI driver imports:

```text
3 pass
1 fail
16 expect() calls

Expected to not contain: "from '../../../../config/models-pi.ts'"
Received: "import { getAllPiModels, getPiModelsForAuthProvider } from '../../../../config/models-pi.ts'; ..."
```

Added a second focused guard test in
`packages/shared/src/agent/backend/internal/drivers/pi.test.ts` before
implementation. The new assertion requires PI model discovery to reject in
`public-untrusted` mode before loading the SDK-backed registry.

Red command:

```bash
cd packages/shared && bun run test src/agent/backend/internal/drivers/pi.test.ts
```

Red output:

```text
1 pass
1 fail
2 expect() calls

Expected promise that rejects
Received promise that resolved: Promise { <resolved> }
```

## 5. Implementation changes

- Replaced module-scope `models-pi.ts` imports in
  `packages/shared/src/agent/backend/internal/drivers/pi.ts` with a local
  `loadPiModelRegistry()` dynamic import helper.
- Kept Copilot live model discovery behavior unchanged while moving the static
  Pi SDK fallback catalog behind the lazy registry helper.
- Added a PI driver dependency-risk guard before `fetchModels` can reach
  Copilot OAuth/static registry discovery.
- Added a PI driver dependency-risk guard before `testConnection` can reach
  SDK-backed model/API endpoint resolution.
- Added a focused `testConnection` unit proof that the lazy path still resolves
  the Anthropic-compatible endpoint and strips the `pi/` model prefix.
- Updated dependency-risk release evidence to reference T114.

## 6. Validation commands run

```bash
bun test scripts/__tests__/pi-sdk-import-boundary-contract.test.ts
cd packages/shared && bun run test src/agent/backend/internal/drivers/pi.test.ts src/agent/__tests__/pi-agent-dependency-risk.test.ts
bun run typecheck:shared
bun test scripts/__tests__/dependency-risk-register-contract.test.ts
bun run validate:docs
git diff --check
git diff --name-only | rg '(^|/)(package\.json|bun\.lock|bun\.lockb|pnpm-lock\.yaml|package-lock\.json|yarn\.lock)$' || true
```

## 7. Passing test output summary

- `pi-sdk-import-boundary-contract.test.ts`: 4 pass, 0 fail, 17
  `expect()` calls.
- `pi.test.ts` plus `pi-agent-dependency-risk.test.ts`: 7 pass, 0 fail, 11
  `expect()` calls.
- `dependency-risk-register-contract.test.ts`: 2 pass, 0 fail, 35
  `expect()` calls.
- `typecheck:shared`: exited 0 after `cd packages/shared && bun run tsc --noEmit`.
- `validate:docs`: agent contract, architecture docs, and sync-v2 design
  validators all reported `ok`.
- `git diff --check`: exited 0.
- Package manifest/lockfile diff guard: no package or lockfile paths were
  reported.

## 8. Remaining risks

- Live Copilot model refresh and provider setup test were not run against real
  credentials; this slice uses import-boundary contracts, dependency-risk unit
  coverage, mocked `testConnection`, docs validation, and typecheck.
- Broader PI runtime still depends on upstream `@mariozechner/pi-ai` advisories;
  public production remains blocked by the dependency-risk register until
  advisories are remediated, isolated, or explicitly accepted.

## 9. Acceptance criteria matrix

| Criteria | Status | Evidence |
|---|---|---|
| Lazy-driver contract fails before implementation and passes after | Done | Red failure recorded above; green `bun test scripts/__tests__/pi-sdk-import-boundary-contract.test.ts` |
| PI driver no longer imports `models-pi.ts` at module scope | Done | Static contract asserts no `from '../../../../config/models-pi.ts'` in `pi.ts` |
| PI driver still resolves static fallback models through lazy import | Done | Dynamic import helper used by static fallback; PI driver tests and typecheck pass |
| PI driver test-connection base URL resolution remains available | Done | `piDriver.testConnection` mocked-fetch unit proof checks `https://api.anthropic.com/v1/messages` |
| Dependency risk evidence references T114 | Done | `accepted-risk-register-2026-05-08.md`, `dependency-risk-register-2026-05-08.md`, and contract test updated |
| Package manifests and lockfiles remain unchanged | Done | Manifest/lockfile diff guard returned no paths |
| Docs validation passes | Done | `bun run validate:docs` passed |
| Worklog complete | Done | This worklog records red/green evidence and residual risk |
| Scoped Lore commit exists | Done | Commit created after final validation |
