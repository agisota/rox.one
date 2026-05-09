# T130 - Pi runtime resource resolution

## Scope

Fix the remaining local desktop runtime blocker after the composer action click-through pass: PI sessions could reach the UI but failed before subprocess startup because the built app did not stage the bundled PI server where the runtime resolver looked.

## Root Cause

- `packages/pi-agent-server/dist/index.js` was produced during build, but `scripts/electron-build-resources.ts` did not stage `pi-agent-server` or `session-mcp-server` into Electron resources before copying `apps/electron/resources` to `apps/electron/dist/resources`.
- Packaged/dev-branded Electron runtime can resolve app code under `resourcesPath/app`, while generated helper servers live under `resourcesPath/app/resources` or `resourcesPath/resources`. `resolveServerPath()` only checked `appRootPath`-relative resource directories.
- Local `.env` sets `ROX_PUBLIC_APP_URL=https://rox.one`; the PI dependency-risk resolver treated that as public untrusted exposure even inside the local Electron desktop host.

## Changes

- Added packaged Electron `resourcesPath` candidates to `resolveServerPath()`.
- Made the Electron resource build stage both generated helper servers before copying resources to `dist`.
- Added host-aware PI dependency-risk resolution: explicit risk env vars still win, but Electron desktop hosts with `resourcesPath` default to `private-local`.
- Propagated the resolved PI risk decision into backend runtime payloads so PI subprocess startup uses the same host-aware decision as model discovery and connection tests.

## Validation

- `bun test packages/shared/src/agent/backend/__tests__/runtime-resolver.test.ts`
- `bun test packages/shared/src/agent/__tests__/pi-agent-dependency-risk.test.ts`
- `bun test packages/shared/src/agent/backend/internal/drivers/pi.test.ts`
- `bun run scripts/electron-build-resources.ts`
- `bun run lint:electron`
- `bun run typecheck:electron`
- `bun run electron:build`
- `bun run electron:dev`

Fresh runtime evidence:

- `apps/electron/dist/resources/pi-agent-server/index.js` exists after resource build.
- `apps/electron/dist/resources/session-mcp-server/index.js` exists after resource build.
- Fresh Electron dev launch logged `Model refresh [slug-A]: fetched 920 models`.
- Fresh Electron dev launch no longer logged `piServerPath not configured`.
- Fresh Electron dev launch no longer logged `PI provider runtime is disabled for public untrusted exposure`.

## Remaining Risks

- Dev runtime still logs expected auto-update noise because `app-update.yml` is not present in `.build/electron-dev-runtime`.
- Credential health still reports no default credentials for `Shape Check Connection`; this is separate from PI server path and PI risk-mode resolution.
- A full provider-backed prompt response still depends on valid local connection credentials and selected model configuration.
