# T312 - Electron typecheck baseline blockers

## 1. Task summary

Restore `bun run typecheck:electron` while verifying the focused PZD-10 /
GitHub #271 artifact-panel branch. The failures were baseline Electron typing
issues around auto-launch settings, not artifact-panel regressions.

## 2. Repo context discovered

- `apps/electron/src/shared/settings-registry.ts` includes a `behavior`
  settings page, but `apps/electron/src/shared/menu-schema.ts` did not map it
  to a menu icon.
- `apps/electron/src/shared/types.ts` exposes `getAutoLaunchDesign` and
  `setAutoLaunchDesign` on `ElectronAPI`.
- `apps/electron/src/main/handlers/preferences-ipc.ts` already registers
  `preferences:get-auto-launch-design` and `preferences:set-auto-launch-design`
  handlers through the GUI RPC server.
- `apps/electron/src/transport/channel-map.ts` did not map those ElectronAPI
  methods, so the compile-time parity guard failed.
- `packages/shared/src/protocol/channels.ts` had generic preferences read/write
  channels but not auto-launch preference channels.
- `packages/shared/src/protocol/routing.ts` classifies app/OS-local channels in
  `LOCAL_ONLY_CHANNELS`.
- `apps/electron/src/main/__tests__/rox-design-view-manager.partition.test.ts`
  only needs a typed minimal `WindowManager` stub for constructor injection.
- `apps/electron/src/renderer/components/onboarding/__tests__/OnboardingPromptModal.rtl.test.tsx`
  used an older Vitest two-generic `vi.fn<Args, Return>()` form.

## 3. Files inspected

- `apps/electron/src/shared/settings-registry.ts`
- `apps/electron/src/shared/menu-schema.ts`
- `apps/electron/src/shared/types.ts`
- `apps/electron/src/main/handlers/preferences-ipc.ts`
- `apps/electron/src/preload/bootstrap.ts`
- `apps/electron/src/transport/channel-map.ts`
- `apps/electron/src/transport/__tests__/channel-map-parity.test.ts`
- `packages/shared/src/protocol/channels.ts`
- `packages/shared/src/protocol/routing.ts`
- `apps/electron/src/main/__tests__/rox-design-view-manager.partition.test.ts`
- `apps/electron/src/renderer/components/onboarding/__tests__/OnboardingPromptModal.rtl.test.tsx`

## 4. Tests added first

No new test files were required. Existing compile-time and runtime tests already
exposed the regression:

- `bun run typecheck:electron`
- `apps/electron/src/transport/__tests__/channel-map-parity.test.ts`
- `apps/electron/src/shared/__tests__/ipc-channels.test.ts`
- `packages/shared/src/protocol/__tests__/routing.test.ts`
- `apps/electron/src/main/__tests__/rox-design-view-manager.partition.test.ts`
- `apps/electron/src/renderer/components/onboarding/__tests__/OnboardingPromptModal.rtl.test.tsx`

## 5. Expected failing test output

Initial `bun run typecheck:electron` failed with:

- `rox-design-view-manager.partition.test.ts`: minimal test object missing the
  rest of the `WindowManager` class shape.
- `OnboardingPromptModal.rtl.test.tsx`: `vi.fn<[AutoLaunchDesignChoice], void>()`
  rejected by the current Vitest mock generic signature.
- `menu-schema.ts`: `SETTINGS_ICONS` missing `behavior`.
- `channel-map-parity.test.ts`: `getAutoLaunchDesign` /
  `setAutoLaunchDesign` missing from `CHANNEL_MAP`.

## 6. Implementation changes

- Added auto-launch preference channel constants to shared `RPC_CHANNELS`.
- Classified auto-launch preference channels as local-only app preference state.
- Mapped `getAutoLaunchDesign` and `setAutoLaunchDesign` in `CHANNEL_MAP`.
- Reused shared `RPC_CHANNELS.preferences.*` constants in the Electron
  preferences handler.
- Added the `behavior` settings page icon mapping to the shared menu schema.
- Updated Onboarding modal tests to current Vitest `vi.fn<Fn>()` typing.
- Cast the minimal Rox Design `WindowManager` test stub at the injection
  boundary without changing the sandbox/partition assertions.

## 7. Validation commands run

- `bun test apps/electron/src/transport/__tests__/channel-map-parity.test.ts apps/electron/src/main/__tests__/rox-design-view-manager.partition.test.ts apps/electron/src/renderer/components/onboarding/__tests__/OnboardingPromptModal.rtl.test.tsx apps/electron/src/shared/__tests__/ipc-channels.test.ts packages/shared/src/protocol/__tests__/routing.test.ts`
- `cd apps/electron && bunx vitest run --config vitest.config.ts src/renderer/components/onboarding/__tests__/OnboardingPromptModal.rtl.test.tsx`
- `bun run typecheck:electron`
- `bun test packages/shared/src/sessions/__tests__/artifacts.test.ts apps/electron/src/shared/__tests__/route-parser-artifact-sidebar.test.ts apps/electron/src/renderer/components/artifacts/__tests__/artifact-sandbox.test.tsx apps/electron/src/renderer/components/artifacts/__tests__/artifact-panel.test.tsx packages/server-core/src/handlers/rpc/__tests__/artifacts-rpc.test.ts apps/electron/src/shared/__tests__/ipc-channels.test.ts packages/shared/src/protocol/__tests__/routing.test.ts`
- `bun run typecheck:shared`
- `cd packages/server-core && bun run tsc --noEmit`
- `bun run electron:build:renderer`

## 8. Passing test output summary

- Baseline targeted Bun tests: 17 pass, 0 fail, 1542 expectations.
- Onboarding RTL Vitest target: 11 tests pass.
- `typecheck:electron`: pass.
- PZD-10 targeted artifact regression tests: 24 pass, 0 fail, 390
  expectations.
- `typecheck:shared`: pass.
- `packages/server-core` `tsc --noEmit`: pass.

## 9. Build output summary

- `electron:build:renderer`: pass; Vite transformed 5678 modules and completed
  the production renderer build.
- Existing warnings remained: dynamic import vars for Shiki packages and chunk
  size warnings over 500 kB.

## 10. Remaining risks

- The auto-launch preference methods are now first-class RPC-mapped local-only
  channels; remote/thin-client semantics were not manually exercised.
- This task fixes type and channel registration baselines only; it does not
  change the PZD-10 artifact panel UX.

## 11. Acceptance criteria matrix

| Criteria | Status | Evidence |
| --- | --- | --- |
| Electron typecheck passes | PASS | `bun run typecheck:electron` |
| Auto-launch preferences mapped and local-only | PASS | `channel-map-parity` + protocol routing tests |
| `behavior` settings page has a menu icon | PASS | `menu-schema.ts` typecheck |
| Rox Design partition test still asserts sandbox isolation | PASS | partition test target passed |
| Onboarding modal test typing current | PASS | Vitest target passed |
| PZD-10 artifact-panel tests still pass | PASS | 24 targeted artifact tests passed |
