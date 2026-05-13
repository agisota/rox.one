# T201 - Stabilize full unit validation

## 1. Task summary

The final package gate passed, but `bun run validate:ci` exposed that the CI contract did not explicitly run the full unit suite. Once `test:units` was run end-to-end, several order-dependent test isolation gaps appeared. This task makes the validation contract explicit, fixes the isolation gaps, and adds a runtime regression for per-server WebUI password hashing.

## 2. Repo context discovered

- `.github/workflows/validate.yml` produced logs for the shell contract, architecture docs, and dev validation, but did not explicitly run `validate:ci` or `test:units`.
- `scripts/validate-ci.ts` expects every `docs/worklog/T*.md` to have a matching `docs/tickets/T*.md`; historical T129/T130 worklogs had no tickets.
- `packages/server-core/src/handlers/rpc/files.test.ts` used broad shared config/workspace module mocks that leaked incomplete exports into later registration tests under the full suite order.
- Several Electron tests installed partial DOM or Electron API mocks that worked in isolation but failed when later files imported modules that needed richer global shapes.
- `packages/server-core/src/webui/auth.ts` kept a module-global password hash, which meant multiple WebUI handlers with different legacy passwords in the same process could affect each other.

## 3. Files inspected

- `.github/workflows/validate.yml`
- `apps/electron/src/main/__tests__/browser-pane-manager.test.ts`
- `apps/electron/src/main/__tests__/session-branch-rollback.isolated.ts`
- `apps/electron/src/main/handlers/__tests__/settings-default-thinking.test.ts`
- `apps/electron/src/renderer/actions/__tests__/keybinding-context.test.ts`
- `apps/electron/src/renderer/components/app-shell/input/__tests__/composer-artifact-panel.test.tsx`
- `apps/electron/src/renderer/components/workbench/__tests__/experience-demo-session-list.test.ts`
- `apps/electron/src/renderer/lib/__tests__/overlay-detection.test.ts`
- `packages/server-core/src/handlers/rpc/files.test.ts`
- `packages/server-core/src/webui/__tests__/http-server.test.ts`
- `packages/server-core/src/webui/auth.ts`
- `packages/server-core/src/webui/http-server.ts`
- `docs/tickets/T129-composer-artifact-clickthrough.md`
- `docs/tickets/T130-pi-runtime-resource-resolution.md`
- `docs/tickets/T201-unit-validation-determinism.md`

## 4. Tests added first

- Added `keeps legacy password hashes scoped to each server instance` in `packages/server-core/src/webui/__tests__/http-server.test.ts`.
- Reproduced the full-order failures with targeted cross-file runs before applying each mock isolation fix.
- Used the full `bun run test:units` suite as the regression harness for cross-file order leakage.

## 5. Expected failing test output

Representative failures before the fixes:

```text
SyntaxError: Export named 'screen' not found in module 'electron'
SyntaxError: Export named 'defaultMidStreamBehavior' not found in module '@craft-agent/shared/config'
```

The WebUI regression would fail before the auth fix because a second server instance could replace the process-wide hashed legacy password used by the first instance.

## 6. Implementation changes

- Updated `.github/workflows/validate.yml` to run and retain logs for `validate:agent-contract`, `validate:architecture-docs`, `validate:ci`, and `test:units`.
- Added missing ticket stubs for T129 and T130 so historical completed worklogs satisfy the CI contract.
- Changed WebUI auth initialization so `initPasswordHash` returns an instance hash and `verifyPassword` receives that hash explicitly.
- Updated the WebUI HTTP handler to await and use its own password hash per handler instance.
- Replaced broad `@craft-agent/shared` mocks in files RPC tests with real temporary config/workspace state via `CRAFT_CONFIG_DIR`.
- Completed Electron and shared config mock surfaces where later imports need `screen`, default local scope, mid-stream behavior, and image support exports.
- Hardened renderer DOM test helpers so they expose the document APIs needed by notification/style insertion code during full-suite runs.
- Mocked `sonner` inside the composer artifact panel test and switched the file to dynamic imports to avoid module-load side effects.
- Replaced a fixed demo session timestamp with the current test timestamp so date grouping remains stable over time.

## 7. Validation commands run

- `bun test packages/server-core/src/handlers/rpc/files.test.ts apps/electron/src/main/handlers/__tests__/registration-profiles.test.ts apps/electron/src/main/handlers/__tests__/registration.test.ts`
- `bun test packages/server-core/src/webui/__tests__/http-server.test.ts packages/server-core/src/webui/__tests__/account-http.test.ts packages/server-core/src/webui/__tests__/auth-rotation.test.ts`
- `bun test apps/electron/src/renderer/components/app-shell/input/__tests__/composer-artifact-panel.test.tsx apps/electron/src/renderer/lib/__tests__/overlay-detection.test.ts apps/electron/src/renderer/actions/__tests__/keybinding-context.test.ts apps/electron/src/main/handlers/__tests__/settings-default-thinking.test.ts apps/electron/src/renderer/components/workbench/__tests__/experience-demo-session-list.test.ts`
- `bun test apps/electron/src/main/__tests__/browser-pane-manager.test.ts apps/electron/src/main/handlers/__tests__/registration-profiles.test.ts apps/electron/src/main/handlers/__tests__/registration.test.ts`
- `bun test ./apps/electron/src/main/__tests__/session-branch-rollback.isolated.ts`
- `bun run test:units`
- `bun install --frozen-lockfile`
- `bun run typecheck:all`
- `bun run lint`
- `bun run test:rtl`
- `cd packages/audit && bun test`
- `bun run e2e:core`
- `bun run validate:audit`
- `bun run validate:ci`
- `bun run build`
- `bun run electron:dist:dev:mac:arm64`
- `bun run electron:smoke:packaged:mac`
- `bun run electron:ui-smoke:packaged:mac`
- `bun run validate:packaged-artifacts`

## 8. Passing test output summary

- Files RPC plus registration targeted order: 7 tests passed.
- WebUI HTTP/auth/account targeted order: 37 tests passed.
- Renderer contamination targeted order: 12 tests passed.
- Browser pane plus registration targeted order: 69 tests passed.
- Session branch rollback isolated suite: 3 tests passed.
- Full unit gate: root suite reported 4,973 pass, 13 skip, 0 fail across 446 files; isolated follow-up suites also reported 0 failures.
- RTL gate: 9 files, 54 tests passed.
- Audit package: 86 tests passed.
- E2E core: 5 scenarios passed: composer artifacts, Experience runtime journey, account/team/billing/storage, server smoke, and Electron startup smoke.
- Audit smoke: static-tsc and bundle checks for webui/viewer/marketing reported 0 findings.
- CI validation script passed, including agent contract, architecture docs, dev validation, doc tools, audit smoke, and i18n checks.
- Packaged UI smoke passed for account tabs/forms, Experience six-tab navigation, and composer primary/overflow actions.

## 9. Build output summary

- `bun run build` passed.
- `bun run electron:dist:dev:mac:arm64` produced the refreshed development macOS package.
- Packaged headless startup passed.
- Packaged UI smoke evidence: `/Users/marklindgreen/.ai-agent-hub/evidence/playwright-smoke/rox-one-ui-smoke-2026-05-13T00-06-29-256Z`.
- Final artifact hashes:
  - DMG: `17a2e2518e1cc83cd825e833cc57db7cb374940e871a090c3a46f88c18621772`
  - ZIP: `2fc795c48a3dc5373dc171ab66997af8048895386208ec45255b57a6349cb9e6`

## 10. Remaining risks

- Hosted GitHub Actions has not been observed after this local CI contract update.
- The local macOS package remains a development package unless notarization/release signing is run separately.
- Large Vite chunk warnings are expected from the current bundle shape and remain covered by audit/package smoke checks.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| CI validation explicitly runs contract and unit gates | Pass | `.github/workflows/validate.yml` updated |
| Historical worklogs have matching tickets | Pass | T129 and T130 tickets added |
| Full `test:units` passes from suite order | Pass | `bun run test:units` completed with 0 failures |
| Server-core mocks do not leak into registration tests | Pass | Targeted files -> registration run passed |
| Electron/renderer mocks do not leak into later imports | Pass | Targeted Electron and renderer order runs passed |
| WebUI password hash is instance scoped | Pass | New HTTP server regression passed |
| Final packaged app is rebuilt and smoke-tested | Pass | Packaged headless and UI smoke passed |
