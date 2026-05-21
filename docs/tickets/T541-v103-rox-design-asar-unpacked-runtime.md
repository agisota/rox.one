# T541 - v1.0.3 Rox Design ASAR-unpacked runtime path

Status: READY FOR REVIEW

## Context

v1.0.3 packages the Rox Design payload outside ASAR at
`Contents/Resources/app.asar.unpacked/resources/rox-design`, but the packaged
runtime manager still resolves from `Contents/Resources/app` and its historical
resource candidates. The installed app starts and the general UI smoke passes,
but `window.electronAPI.roxDesign.start()` fails because the sidecar payload is
not found.

## Goal

Make packaged Rox Design resolve the `app.asar.unpacked` payload and add a
validation guard so future release artifacts cannot ship with the same
runtime-path mismatch.

## Required UI

No UI change.

## Required Data/API

- Preserve existing dev runtime and explicit `ROX_DESIGN_RUNTIME_ROOT` behavior.
- Preserve the packaged ASAR startup posture.
- Keep mutable Rox Design data outside the sealed packaged app bundle.

## Required Automations

- Runtime manager unit coverage for ASAR-unpacked payload resolution.
- Packaged artifact validation coverage for the external Rox Design payload.

## TDD Requirements

1. Add a failing runtime-manager test for packaged
   `app.asar.unpacked/resources/rox-design`.
2. Add a failing packaged-artifact validator test for missing external Rox
   Design payload.
3. Add a failing runtime-manager test that sidecar writable data does not
   default under the bundled runtime root.
4. Implement the smallest runtime, main-process wiring, and validator changes
   needed to pass.

## Validation Commands

- `bun test apps/electron/src/main/__tests__/rox-design-runtime-manager.test.ts`
- `bun test scripts/__tests__/validate-packaged-artifacts.test.ts`
- `ROX_MAC_APP_PATH=/Applications/ROX.ONE.app bun run electron:smoke:packaged:mac`
- Manual installed-app Rox Design start probe via CDP.

## Acceptance Criteria

- [x] Runtime manager finds ASAR-unpacked Rox Design payload in packaged layout.
- [x] Packaged artifact validator fails when the external Rox Design payload is
      absent.
- [x] Mutable Rox Design data is routed outside the bundled runtime root.
- [x] Targeted tests pass.
- [ ] Installed app Rox Design start probe passes on the rebuilt/fixed app.

Note: the installed v1.0.3 app's Rox Design payload passed a direct start probe
after a local symlink mapped the current lookup path to `app.asar.unpacked`.
The remaining unchecked item needs a rebuilt app from this source hotfix.

## Worklog

Update `docs/worklog/T541-v103-rox-design-asar-unpacked-runtime.md`.
