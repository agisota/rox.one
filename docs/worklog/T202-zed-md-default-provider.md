# T202 - ZED.MD default provider for ROX.ONE

## Task summary

Fix ROX.ONE API setup so `api.zed.md/v1` is the default OpenAI-compatible provider, install the supplied API key as the local default credential, and remove the `spawn ENOEXEC` setup-test path for this endpoint.

## Repo context discovered

- Onboarding renders API setup through `apps/electron/src/renderer/components/apisetup/ApiKeyInput.tsx`.
- Credential submission is handled by `apps/electron/src/renderer/hooks/useOnboarding.ts`.
- Setup tests reach `packages/shared/src/agent/backend/factory.ts`, then `packages/shared/src/agent/backend/internal/drivers/pi.ts`.
- Local ROX config is under `~/.rox`; current default before this task was not `api.zed.md`.

## Files inspected

- `apps/electron/src/renderer/components/apisetup/ApiKeyInput.tsx`
- `apps/electron/src/renderer/components/apisetup/submit-helpers.ts`
- `apps/electron/src/renderer/components/apisetup/__tests__/ApiKeyInput.test.ts`
- `apps/electron/src/renderer/hooks/useOnboarding.ts`
- `packages/shared/src/agent/backend/factory.ts`
- `packages/shared/src/agent/backend/internal/drivers/pi.ts`
- `packages/shared/src/agent/backend/internal/drivers/pi.test.ts`
- `packages/shared/src/agent/backend/__tests__/factory.test.ts`
- `~/.rox/config.json`

## Tests added first

- `apps/electron/src/renderer/components/apisetup/__tests__/ApiKeyInput.test.ts`
  - `resolveEndpointSubmitMetadata` routes `zed-md` as `customEndpoint.api='openai-completions'` with `piAuthProvider='openai'`.
  - Non-custom Pi provider routing remains unchanged.
  - Arbitrary custom Anthropic-compatible endpoints still map to `piAuthProvider='anthropic'`.
- `packages/shared/src/agent/backend/internal/drivers/pi.test.ts`
  - `buildVersionedEndpoint` avoids duplicate `/v1`.
  - `piDriver.testConnection` validates OpenAI-compatible custom endpoints via direct `/chat/completions` HTTP.

## Expected failing output

Initial targeted test run failed before implementation as expected:

```text
Export named 'resolveEndpointSubmitMetadata' not found
Export named 'buildVersionedEndpoint' not found
0 pass
2 fail
```

## Implementation changes

- Added ZED.MD as the first/default onboarding preset with `https://api.zed.md/v1`.
- Updated ROX/ZED preset model defaults to the operator-approved model list.
- Added preset-driven custom endpoint metadata so ZED.MD submits as OpenAI-compatible.
- Added direct OpenAI-compatible setup validation in the Pi driver to bypass generic subprocess fallback.

## Validation commands run

- `bun test apps/electron/src/renderer/components/apisetup/__tests__/ApiKeyInput.test.ts packages/shared/src/agent/backend/internal/drivers/pi.test.ts`
- `bun test apps/electron/src/renderer/components/apisetup/__tests__/ApiKeyInput.test.ts packages/shared/src/agent/backend/internal/drivers/pi.test.ts packages/shared/src/agent/backend/__tests__/factory.test.ts packages/server-core/src/domain/connection-setup-logic.test.ts`
- `bun run typecheck:electron`
- `bun run electron:build`
- `bun run electron:dist:dev:mac:arm64`
- `bun run electron:smoke`
- Direct `https://api.zed.md/v1/chat/completions` probe using the stored local credential.
- `testBackendConnection` through the app backend factory using `provider='pi'`, `providerType='pi_compat'`, `piAuthProvider='openai'`, and `customEndpoint.api='openai-completions'`.
- Installed rebuilt bundle into `/Applications/ROX ONE.app`; previous bundle moved to `/Applications/ROX ONE.app.backup-20260513T154500Z`.

## Passing output summary

- Focused TDD targets: `17 pass, 0 fail`.
- Expanded backend/setup coverage: `79 pass, 1 skip, 0 fail, 120 expect calls`.
- Typecheck: exit 0.
- Direct ZED.MD HTTP probe: status 200 with response content `ok`.
- App backend setup-test path: `{"success":true}`.
- Local config now has `defaultLlmConnection='zed-md-api-key'`, `setupDeferred=false`, `baseUrl='https://api.zed.md/v1'`, `providerType='pi_compat'`, `authType='api_key_with_endpoint'`, `defaultModel='cx/gpt-5.5'`, `customEndpoint.api='openai-completions'`, `piAuthProvider='openai'`, and the 15 requested model IDs.
- Secure credential store returns a non-empty key for `zed-md-api-key`.
- Installed bundle contains the ZED.MD preset, requested models, and OpenAI-compatible endpoint metadata.
- Launch proof: `/Applications/ROX ONE.app` starts and spawns the expected `ROX.ONE` renderer/helper processes; messaging gateway log records bootstrap from `/Applications/ROX ONE.app/Contents/Resources/messaging-whatsapp-worker/worker.cjs` at `2026-05-13T15:44:05Z`.

## Build output summary

- `bun run electron:build`: completed successfully; Vite emitted only existing large-chunk warnings.
- `bun run electron:dist:dev:mac:arm64`: completed successfully and produced `apps/electron/release/mac-arm64/ROX.ONE.app`, `apps/electron/release/ROX-ONE-arm64.dmg`, and `apps/electron/release/ROX-ONE-arm64.zip`.
- `bun run electron:smoke`: completed successfully in headless startup mode.

## Remaining risks

- `bun run electron:ui-smoke:packaged:mac` timed out waiting for the account shell with `CDP command timed out: Runtime.evaluate` and empty visible text. The packaged app did launch far enough to start the messaging gateway, but this smoke did not produce screenshot evidence for the UI shell.
- The installed app bundle is ad-hoc signed/dev packaged; notarization remains skipped by the existing build pipeline.

## Acceptance matrix

- [x] ZED.MD default provider preset.
- [x] Exact approved model list prefilled.
- [x] ZED.MD submit emits OpenAI-compatible custom endpoint metadata.
- [x] Pi driver validates OpenAI-compatible custom endpoints directly.
- [x] Local default connection installed in `~/.rox`.
- [x] Tests pass.
- [x] Build passes.
- [x] Commit created.
