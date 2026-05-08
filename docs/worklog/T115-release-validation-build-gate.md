# T115 - Release Validation Build Gate Worklog

## 1. Task summary

Build the application and verify it works. Initial release validation stopped
before Electron packaging because the test gate failed.

Initial state:

```text
## mac/rox-production-ready-rc...origin/mac/rox-production-ready-rc [ahead 17]
```

## 2. Red evidence

Initial command:

```bash
bun run validate:release
```

Release validation failed during `bun test`:

```text
4762 pass
13 skip
2 fail
1 snapshots
12479 expect() calls
Ran 4777 tests across 407 files.
```

Failing tests:

```text
phase4 backend abstraction APIs > fetchBackendModels dispatches for pi provider
Agent Forge and Team Registry > renders private/team registry, package contracts, install, fork, and forge gauntlet
```

Focused Agent Forge red command:

```bash
bun test apps/electron/src/renderer/components/workbench/__tests__/agent-forge-team-registry.test.tsx
```

Focused result before repair:

```text
7 pass
1 fail
```

The rendered markup includes `>Установить<` and `>Форкнуть<`, while the stale
test expected both buttons to be absent.

## 3. Diagnosis

- The PI provider factory dispatch test is a private/local dispatch proof, but
  the repository `.env` sets `ROX_PUBLIC_APP_URL=https://rox.one`. That makes
  PI dependency-risk resolution public-untrusted and correctly blocks runtime
  model discovery.
- The Agent Forge registry UI currently renders install/fork package controls.
  The stale SSR test contradicted the component contract by forbidding those
  controls.

## 4. Implementation changes

- Updated `packages/shared/src/agent/backend/__tests__/factory.test.ts` so the
  PI provider factory dispatch test explicitly sets
  `ROX_PI_PROVIDER_DEPENDENCY_RISK_MODE=private-local` and restores the prior
  environment value in `finally`.
- Updated
  `apps/electron/src/renderer/components/workbench/__tests__/agent-forge-team-registry.test.tsx`
  so the SSR contract requires the current install/fork controls and blocked
  package status copy instead of forbidding the buttons.

## 5. Validation commands run

```bash
bun test apps/electron/src/renderer/components/workbench/__tests__/agent-forge-team-registry.test.tsx
bun test src/agent/backend/__tests__/factory.test.ts
bun run validate:release
bun run electron:smoke
bun run electron:dist:dev:mac:arm64
bun run electron:smoke:packaged:mac
bun run validate:packaged-artifacts
git diff --check
git diff --name-only | rg '(^|/)(package\.json|bun\.lock|bun\.lockb|pnpm-lock\.yaml|package-lock\.json|yarn\.lock)$' || true
```

## 6. Passing evidence summary

- Agent Forge focused test: 8 pass, 0 fail, 27 `expect()` calls.
- PI provider factory focused test: 36 pass, 1 skip, 0 fail, 46 `expect()`
  calls.
- `validate:release`: docs, lint, typecheck, full `bun test`, Electron build,
  Mac ARM workflow validator, and private release pipeline validator passed.
- Full `bun test` inside `validate:release`: 4764 pass, 13 skip, 0 fail,
  1 snapshot, 12484 `expect()` calls across 407 files.
- `electron:smoke`: `[smoke] Electron headless startup passed`.
- `electron:dist:dev:mac:arm64`: produced
  `apps/electron/release/ROX-ONE-arm64.dmg`,
  `apps/electron/release/ROX-ONE-arm64.zip`, both blockmaps, and
  `latest-mac.yml`.
- `electron:smoke:packaged:mac`: `[packaged-smoke] ROX.ONE packaged headless startup passed`.
- `validate:packaged-artifacts`: required artifacts present and latest metadata
  verified.

Packaged artifact checksums:

```text
SHA256 ROX-ONE-arm64.dmg 679551435f713a3298a010182a0223c31f9355be024d3fe558b36d8efe272f9e
SHA256 ROX-ONE-arm64.zip 1c21a4d6ba73f3908b2462b2968bbb25d57c3ac80e24224dfce9193aa59e6c30
```

Packaged artifact sizes:

```text
ROX-ONE-arm64.dmg 324546245 bytes
ROX-ONE-arm64.zip 313644282 bytes
ROX-ONE-arm64.dmg.blockmap 340798 bytes
ROX-ONE-arm64.zip.blockmap 320971 bytes
latest-mac.yml 479 bytes
```

## 7. Remaining risks

- Packaging used ad-hoc macOS signing and skipped notarization because no
  notarization credentials/options were available in this local build lane.
- Electron builder warned that `Assets.car` is older than current icon sources
  and used the fallback `icon.icns`.
- Free disk space is still tight after packaging, around 6-7 GiB available.
  Build artifacts were preserved because the task was to produce and verify the
  app.
