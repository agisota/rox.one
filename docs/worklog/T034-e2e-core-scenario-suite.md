# T034 - E2E Core Scenario Suite

## 1. Task summary

Create a reproducible ROX ONE core end-to-end scenario suite that covers the composer artifact flow, account/team/billing/storage surfaces, server startup, and Electron startup without real provider, S3, billing, or OAuth calls.

## 2. Repo context discovered

- Existing UI and account slices already had focused Bun tests for composer artifact screens, account auth, teams, billing, and object storage.
- Existing server smoke coverage lived in `packages/server/src/__tests__/smoke.test.ts`, but the harness inherited machine `.env` values and user-home lock paths.
- Existing Electron smoke coverage was exposed through the `electron:smoke` package script and can launch only outside the Codex sandbox or on a macOS runner.
- Existing CI workflows use GitHub Actions with Bun and macOS runners for desktop validation.

## 3. Files inspected

- `package.json`
- `packages/server/src/__tests__/smoke.test.ts`
- `scripts/electron-smoke.ts`
- `scripts/electron-dist-dev-mac-arm64.ts`
- `.github/workflows/mac-arm-build.yml`
- `apps/electron/src/renderer/components/app-shell/input/__tests__/composer-artifact-flow.test.ts`
- `apps/electron/src/renderer/components/workbench/__tests__/artifact-screens.test.tsx`
- `apps/electron/src/renderer/pages/settings/__tests__/account-auth-panel.test.tsx`
- `packages/server-core/src/webui/__tests__/account-teams.test.ts`
- `packages/server-core/src/webui/__tests__/account-billing.test.ts`
- `packages/server-core/src/storage/__tests__/object-storage.test.ts`

## 4. Tests added first

- Added `scripts/validate-e2e-core-scenarios.ts` as the red contract check for the suite wiring.
- Initial red command: `bun run scripts/validate-e2e-core-scenarios.ts`
- The validator asserts:
  - `package.json` exposes `e2e:core` and `validate:e2e-core-scenarios`.
  - `scripts/e2e-core-scenarios.ts` exists.
  - `.github/workflows/e2e-core.yml` exists.
  - The suite includes composer, artifact screen, account auth, team, billing, storage, server smoke, and Electron smoke scenarios.
  - Fake-provider mode is mandatory.
  - External provider and S3 secret names are not embedded in the suite.

## 5. Expected failing test output

`bun run scripts/validate-e2e-core-scenarios.ts`

```text
[e2e-core] package.json missing script: e2e:core
```

This was the expected failure because no T034 suite script or workflow existed yet.

## 6. Implementation changes

- Added `scripts/e2e-core-scenarios.ts`, a fail-fast core scenario runner that writes per-scenario logs to `.e2e-logs/`.
- Added `scripts/validate-e2e-core-scenarios.ts`, a local and CI contract validator for suite coverage and fake-provider safety.
- Added `.github/workflows/e2e-core.yml` for macOS CI validation and `.e2e-logs` artifact upload.
- Added package scripts:
  - `e2e:core`
  - `validate:e2e-core-scenarios`
- Hardened `packages/server/src/__tests__/smoke.test.ts` so server smoke tests:
  - clear local `.env` account/email/database variables inherited by Bun,
  - run with isolated temp `HOME` and `ROX_APP_ROOT`,
  - remove temporary state after each spawned server.

## 7. Validation commands run

- `bun run scripts/validate-e2e-core-scenarios.ts` - expected red before implementation.
- `bun run validate:e2e-core-scenarios` - passed.
- `bun test packages/server/src/__tests__/smoke.test.ts` - failed before harness isolation, then passed after isolation.
- `bun run e2e:core` - passed outside the Codex sandbox.
- `bun run e2e:core` inside the Codex sandbox - composer/account/server scenarios passed; Electron smoke failed with sandbox `SIGABRT`, then passed outside the sandbox.

- `git diff --check` - passed.
- `bun run typecheck:all` - passed.

## 8. Passing test output summary

`bun run e2e:core` outside the sandbox:

- `composer-artifacts`: 9 passed, 47 expectations.
- `account-team-billing-storage`: 19 passed, 74 expectations.
- `server-smoke`: 4 passed, 5 expectations.
- `electron-startup-smoke`: Electron headless startup passed.
- Final runner output: `[e2e-core] all core scenarios passed`.

`bun test packages/server/src/__tests__/smoke.test.ts`:

- 4 passed.
- 5 expectations.

`bun run validate:e2e-core-scenarios`:

- `[e2e-core] ok: core scenario suite contract passed`.

`bun run typecheck:all`:

- All package TypeScript checks completed with exit code 0.

`git diff --check`:

- Completed with exit code 0.

## 9. Build output summary

`electron:smoke` builds the Electron main, preload, renderer, resources, and copied assets before launching the headless startup check. The T034 run completed the Electron smoke build/start path outside the sandbox and exited cleanly after startup readiness.

## 10. Remaining risks

- The GitHub Actions workflow has not been executed on GitHub from this local session.
- Electron smoke requires a macOS GUI-capable environment; the Codex sandbox still fails the Electron launch with `SIGABRT`.
- The suite deliberately excludes external OAuth, real LLM, real S3, and real DV.net payment paths; those require explicit opt-in test environments.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| Core E2E runner exists | Pass | `scripts/e2e-core-scenarios.ts` |
| CI workflow exists | Pass | `.github/workflows/e2e-core.yml` |
| Composer artifact flow covered | Pass | `composer-artifacts` scenario |
| Account/team/billing/storage covered | Pass | `account-team-billing-storage` scenario |
| Server startup covered | Pass | `server-smoke` scenario |
| Electron startup covered | Pass | `electron-startup-smoke` scenario outside sandbox |
| Fake-provider mode enforced | Pass | Validator requires `ROX_E2E_FAKE_PROVIDERS` |
| No real provider/S3 secrets embedded | Pass | Validator rejects provider/S3 secret names |
| Logs captured for triage | Pass | `.e2e-logs/<scenario>.log` |
| Local validation green | Pass | `bun run e2e:core` outside sandbox passed |
