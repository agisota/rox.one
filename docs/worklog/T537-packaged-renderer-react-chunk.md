# Worklog — T537 cross-platform packaged launch compatibility

## 1. Task summary
Fix and guard ROX.ONE packaged startup across supported desktop release surfaces. The first live failure was the macOS packaged renderer hanging on the loading screen because the generated `i18n-*` chunk tried to use an undefined React runtime. The same task also adds platform compatibility guards for macOS Sonoma/Sequoia/Tahoe releases, Windows x64 packaged launch, and Linux launch/install surfaces for Ubuntu, Debian, Fedora, and NixOS.

## 2. Repo context discovered
- Root task contract requires ticket-first work under `docs/tickets/*.md`, validation before implementation, and a complete worklog before commit.
- There is no `mise.toml`; root `package.json`/Bun scripts are the active task interface.
- Electron renderer chunking is configured in `apps/electron/vite.config.ts` and executed through `scripts/electron-build-renderer.ts`.
- Packaged macOS artifacts are produced under `apps/electron/release/mac-<arch>/ROX.ONE.app` and validated by `scripts/validate-packaged-artifacts.ts`.
- macOS CI already has `macos-15-xlarge` coverage, which is Sequoia-class hosted hardware; local host is newer Tahoe, so Sequoia and older macOS need CI/lab evidence.
- Linux release artifacts include AppImage, deb, and rpm targets; Linux install routing lives in `scripts/install-app.sh`.
- Windows release artifacts use electron-builder NSIS and `apps/electron/release/win-unpacked/ROX.ONE.exe` for unpacked smoke.
- GitHub-hosted runners can prove Windows x64 hosted-runner launch, but not literal consumer Windows 10/11 desktop SKUs; true Windows 10/11 proof still needs self-hosted/VM lab.

## 3. Files inspected
- `AGENTS.md`
- `package.json`
- `apps/electron/package.json`
- `apps/electron/electron-builder.yml`
- `apps/electron/vite.config.ts`
- `apps/electron/src/main/auto-update.ts`
- `apps/electron/src/main/__tests__/auto-update.signature.test.ts`
- `scripts/electron-build-renderer.ts`
- `scripts/electron-smoke.ts`
- `scripts/electron-smoke-packaged-mac.ts`
- `scripts/electron-ui-smoke-packaged-mac.ts`
- `scripts/install-app.sh`
- `scripts/validate-packaged-artifacts.ts`
- `scripts/__tests__/validate-packaged-artifacts.test.ts`
- `.github/workflows/mac-arm-build.yml`
- `.github/workflows/release-all-platforms.yml`
- `.github/workflows/windows-unsigned-release.yml`
- `.github/workflows/linux-signed-release.yml`

## 4. Tests added first
- `scripts/validate-renderer-chunks.isolated.ts` reproduces the broken React/i18n circular import shape and accepts the one-way i18n -> React dependency shape.
- `scripts/__tests__/validate-packaged-artifacts.test.ts` now creates macOS `Info.plist` fixtures and asserts that `LSMinimumSystemVersion=12.0` fails while `14.0` passes.
- `scripts/validate-linux-installer-launcher.ts` asserts AppImage install path, stale mount cleanup, `APPIMAGE` env, `--no-sandbox`, Debian/Ubuntu and Fedora FUSE hints, and NixOS `appimage-run` wiring.
- `scripts/__tests__/electron-packaged-smoke-contract.test.ts` now asserts a cross-platform packaged smoke harness exists for macOS, Linux, and Windows.
- `scripts/validate-cross-platform-launch-workflow.ts` asserts the workflow, package scripts, packaged smoke harness, and distro guard tokens are wired.
- `scripts/validate-mac-diag-smoke-workflow.ts` asserts the diagnostic workflow stays on runnable Sonoma/Sequoia GitHub-hosted runners, keeps authenticated installs, uploads screenshots/logs, and excludes pre-Sonoma runners from the current supported matrix.
- `apps/electron/src/main/__tests__/auto-update.signature.test.ts` asserts `ROX_E2E=1` disables live update checks during packaged UI smoke.

## 5. Expected failing test output
Observed RED proof before implementation:

```text
scripts/__tests__/electron-packaged-smoke-contract.test.ts:
error: ENOENT: no such file or directory, open '.../scripts/electron-smoke-packaged.ts'
(fail) packaged Electron smoke contract > uses clean process exit as packaged readiness proof without stale required markers

[cross-platform-launch-workflow] missing .github/workflows/cross-platform-launch.yml
```

Prior RED proof from the packaged-renderer fix:

```text
[renderer-chunks] validation failed:
- React runtime chunk and i18n chunk import each other; this is the packaged-loader crash shape.
```

macOS compatibility fixture RED:

```text
[packaged-artifacts] LSMinimumSystemVersion must be 14.0 for Sonoma-and-newer compatibility; got: 12.0
```

## 6. Implementation changes
- `apps/electron/vite.config.ts`
  - Added exact `node_modules/<package>/` matching for React, React DOM, scheduler, i18n, and sonner chunks.
  - Removed the broad `/react/` substring match that also captured packages such as `@tiptap/react` and created React/i18n circular chunks.
- `scripts/electron-build-renderer.ts`
  - Captures Vite stdout/stderr and treats Rollup `Circular chunk:` output as fatal.
- `scripts/validate-renderer-chunks.ts`
  - Adds a build-output validator for missing React/i18n chunks and the known bidirectional React/i18n import graph.
- `apps/electron/electron-builder.yml`
  - Pins `mac.minimumSystemVersion: "14.0"` for Sonoma and newer.
- `scripts/validate-packaged-artifacts.ts`
  - Validates macOS packaged `Info.plist` for `LSMinimumSystemVersion=14.0` and `CFBundleIdentifier=com.rox.one`.
- `scripts/install-app.sh`
  - Adds NixOS detection and `appimage-run "$APPIMAGE_PATH" --no-sandbox "$@"` launch path.
  - Adds NixOS remediation hint: `nix profile install nixpkgs#appimage-run`.
- `scripts/electron-smoke-packaged.ts`
  - Adds cross-platform packaged headless startup smoke for:
    - `mac-arm64/ROX.ONE.app/Contents/MacOS/ROX.ONE`
    - `linux-unpacked/rox-one` with `--no-sandbox` and optional `xvfb-run -a`
    - `win-unpacked/ROX.ONE.exe`
  - Uses isolated `ROX_SMOKE_USER_DATA_DIR` and `ROX_CONFIG_DIR`.
- `.github/workflows/cross-platform-launch.yml`
  - Adds manual/PR/main workflow with macOS Sequoia packaged smoke, Ubuntu 22.04/24.04 packaged launch under Xvfb, Windows hosted-runner packaged launch, and Debian/Fedora/NixOS launcher guards.
- `.github/workflows/mac-diag-smoke.yml`
  - Adds per-OS macOS white-window diagnostic smoke for Sonoma/Sequoia, uploads screenshot + `diag.log` + electron-builder logs, authenticates GitHub Release downloads during `bun install`, and excludes `macos-13` from the push matrix because it stayed queued without allocating a runner.
- `apps/electron/src/main/diag/diag-logger.ts`
  - Adds opt-in `ROX_DIAG=1` startup breadcrumbs for packaged Electron launches without changing normal app behavior.
- `apps/electron/src/main/index.ts`
  - Wires the diagnostic logger into the main-process startup path.
- `scripts/validate-mac-diag-smoke-workflow.ts`
  - Guards the diagnostic workflow contract and the non-blocking pre-Sonoma boundary.
- `package.json`
  - Adds `validate:mac-diag-smoke-workflow` and includes it in `validate:ci`.
- `apps/electron/src/main/auto-update.ts`
  - Treats `ROX_E2E=1` as an update-disable guard so UI smoke cannot race a live update check/install.
- `scripts/electron-ui-smoke-packaged-mac.ts`
  - Captures app stdout/stderr and recent main logs into the evidence directory.
  - Uses current quick-action wrapper behavior instead of expecting old artifact panels.

## 7. Validation commands run
Targeted checks already run during implementation:

```bash
bun test scripts/__tests__/electron-packaged-smoke-contract.test.ts
bun run validate:cross-platform-launch-workflow
bun test apps/electron/src/main/__tests__/auto-update.signature.test.ts scripts/__tests__/electron-packaged-smoke-contract.test.ts
bun run validate:linux-installer-launcher
bun run validate:mac-diag-smoke-workflow
bun test ./scripts/validate-renderer-chunks.isolated.ts
bun run validate:renderer-chunks
ROX_RC_MODE=unsigned ROX_ARTIFACT_PLATFORM=mac ROX_ARTIFACT_ARCH=arm64 bun run validate:packaged-artifacts
bun run electron:build
```

Final local gate rerun notes:

```bash
bun run validate:ci
# first attempt failed because this new ticket missed the required Status line:
# [agent-contract] T537-packaged-renderer-react-chunk.md missing Status line
# fixed by adding Status: DONE, then rerun below.

bun run electron:dist:dev:mac:arm64
bun run electron:smoke:packaged:mac
ROX_RC_MODE=unsigned ROX_ARTIFACT_PLATFORM=mac ROX_ARTIFACT_ARCH=arm64 bun run electron:smoke:packaged
ROX_RC_MODE=unsigned ROX_ARTIFACT_PLATFORM=mac ROX_ARTIFACT_ARCH=arm64 bun run validate:packaged-artifacts
bun run electron:ui-smoke:packaged:mac
```

Final `validate:ci` rerun after ticket metadata repair passed:

```text
[agent-contract] ok: 11 skills, 494 tickets, 7 required docs
[architecture-docs] ok: 4 docs, 10 subsystem headings
[ci-contract] ok: workflow, package scripts, and validator fixture checks passed
[private-release-pipeline] ok: manual-dispatch + tag-guard + pre-build gate + checksums asserted
[release-all-platforms-workflow] ok: update-feed workflow contract passed
[cross-platform-launch-workflow] ok: desktop launch workflow + packaged smoke contracts are wired
[linux-installer-launcher] ok: Debian/Ubuntu, Fedora, and NixOS launcher hints are wired
typecheck:all passed
test:shared:all passed: 20 + 4 + 67 shared/config tests
test:doc-tools passed: Ran 19 tests OK
validate:audit passed: OK: audit smoke clean
lint:i18n:parity passed: i18n parity OK (7 locales, 1614 keys each)
lint:i18n:sorted passed
lint:i18n:coverage passed: i18n coverage OK (1541 literal references, 1160 files scanned)
```

## 8. Passing test output summary
Observed passing output:

```text
scripts/__tests__/electron-packaged-smoke-contract.test.ts: 1 pass
apps/electron/src/main/__tests__/auto-update.signature.test.ts: 47 pass
[cross-platform-launch-workflow] ok: desktop launch workflow + packaged smoke contracts are wired
[linux-installer-launcher] ok: Debian/Ubuntu, Fedora, and NixOS launcher hints are wired
[renderer-chunks] ok: 341 JS chunks checked
[packaged-artifacts] LSMinimumSystemVersion=14.0
[packaged-artifacts] CFBundleIdentifier=com.rox.one
```

## 9. Build output summary
Observed build output so far:

```text
bun run electron:build
[renderer-chunks] ok: 341 JS chunks checked
```

Local packaged macOS ARM64 dist completed:

```text
apps/electron/release/ROX-ONE-arm64.dmg 217.85 MB
apps/electron/release/ROX-ONE-arm64.zip 210.31 MB
```

Packaged launch smoke:

```text
bun run electron:smoke:packaged:mac
[packaged-smoke] ROX.ONE packaged headless startup passed

ROX_RC_MODE=unsigned ROX_ARTIFACT_PLATFORM=mac ROX_ARTIFACT_ARCH=arm64 bun run electron:smoke:packaged
[packaged-smoke] Launching darwin packaged executable: apps/electron/release/mac-arm64/ROX.ONE.app/Contents/MacOS/ROX.ONE
[packaged-smoke] ROX.ONE packaged headless startup passed
```

Packaged artifact validation:

```text
[packaged-artifacts] LSMinimumSystemVersion=14.0
[packaged-artifacts] CFBundleIdentifier=com.rox.one
[packaged-artifacts] required packaged artifacts present
- apps/electron/release/ROX-ONE-arm64.dmg :: 228431193 bytes (217.85 MB)
- apps/electron/release/ROX-ONE-arm64.zip :: 220527805 bytes (210.31 MB)
[packaged-artifacts] latest-mac.yml path=ROX-ONE-arm64.zip
[packaged-artifacts] mode=unsigned-beta
[packaged-artifacts] platform=mac
```

Packaged UI smoke:

```text
[ui-smoke] account tabs/forms OK
[ui-smoke] experience six-tab navigation OK
[ui-smoke] composer primary and overflow quick actions OK
[ui-smoke] packaged ROX.ONE UI smoke passed; evidence: /Users/marklindgreen/.ai-agent-hub/evidence/playwright-smoke/rox-one-ui-smoke-rebuilt-20260519T153804Z
```



Final targeted regression rerun after the full local gate:

```text
bun test apps/electron/src/main/__tests__/auto-update.signature.test.ts scripts/__tests__/electron-packaged-smoke-contract.test.ts scripts/__tests__/validate-packaged-artifacts.test.ts ./scripts/validate-renderer-chunks.isolated.ts
72 pass, 0 fail, 163 expect() calls

bun run validate:renderer-chunks
[renderer-chunks] ok: 341 JS chunks checked

bun run validate:cross-platform-launch-workflow
[cross-platform-launch-workflow] ok: desktop launch workflow + packaged smoke contracts are wired

bun run validate:linux-installer-launcher
[linux-installer-launcher] ok: Debian/Ubuntu, Fedora, and NixOS launcher hints are wired

ruby -e 'require "yaml"; Dir[".github/workflows/*.yml"].sort.each { |f| YAML.load_file(f); puts "ok #{f}" }'
ok .github/workflows/cross-platform-launch.yml
```

## 9a. Local installed-app recovery evidence
After the user reported that the installed application did not load, I verified the stale installed bundle and replaced it with the freshly rebuilt packaged app:

```text
/Applications/ROX ONE.app before replacement: CFBundleShortVersionString=0.9.2, ad-hoc signed, LSMinimumSystemVersion=12.0
ROX_MAC_APP_PATH='/Applications/ROX ONE.app' bun run electron:smoke:packaged:mac
[packaged-smoke] ROX.ONE packaged startup timed out after 30000ms; escalated to SIGKILL after 5000ms grace
```

The rebuilt app was installed to `/Applications/ROX ONE.app` after preserving the old bundle under `/Users/marklindgreen/.ai-agent-hub/backups/rox-one-app/`:

```text
/Applications/ROX ONE.app after replacement: CFBundleShortVersionString=1.0.0-rc.7
LSMinimumSystemVersion=14.0
CFBundleIdentifier=com.rox.one
codesign --verify --deep --strict /Applications/ROX ONE.app -> OK
```

Installed-app verification passed on both isolated smoke data and the real user profile:

```text
ROX_MAC_APP_PATH='/Applications/ROX ONE.app' bun run electron:smoke:packaged:mac
[packaged-smoke] ROX.ONE packaged headless startup passed

ROX_MAC_APP_PATH='/Applications/ROX ONE.app' bun run electron:ui-smoke:packaged:mac
[ui-smoke] account tabs/forms OK
[ui-smoke] experience six-tab navigation OK
[ui-smoke] composer primary and overflow quick actions OK
[ui-smoke] packaged ROX.ONE UI smoke passed; evidence: /Users/marklindgreen/.ai-agent-hub/evidence/playwright-smoke/rox-one-ui-smoke-installed-rebuilt-20260519T153939Z

normal real-profile launch with updater path enabled:
[normal-real-profile-smoke] installed app renderer loaded with normal update path
```

The app was then launched normally via `open -a '/Applications/ROX ONE.app'`; process `ROX.ONE` is running from `/Applications/ROX ONE.app/Contents/MacOS/ROX.ONE`.

Remote PR CI evidence (PR #261, latest run set from 2026-05-19T15:49:29Z):

```text
Cross Platform Launch Smoke: success (run 26108546079)
- macOS Sequoia ARM64 packaged launch: success; build, package, smoke, artifact validation, evidence upload all passed.
- Windows packaged launch (windows-latest): success; build, unpacked smoke, NSIS package, artifact validation, evidence upload all passed.
- Windows packaged launch (windows-2022): success; build, unpacked smoke, NSIS package, artifact validation, evidence upload all passed.
- Linux Ubuntu packaged launch (ubuntu-24.04): success; Xvfb smoke, AppImage/deb/rpm package, artifact validation, evidence upload all passed.
- Linux Ubuntu packaged launch (ubuntu-22.04): success; Xvfb smoke, AppImage/deb/rpm package, artifact validation, evidence upload all passed.
- Linux installer launcher guard (debian): success.
- Linux installer launcher guard (fedora): success.
- Linux installer launcher guard (nixos): success.

Other PR checks: Secret Scan success, E2E Core Scenarios success, Mac ARM Build success, Validate success.
```

Remote PR #264 diagnostic follow-up after adding the macOS white-window diag workflow:

```text
Mac White-Window Diag Smoke run 26123030003: macos-14 success, macos-15 success, macos-13 stayed QUEUED with no steps after other checks finished.
The next commit intentionally removes macos-13 from the automatic push matrix and records Ventura exact GUI proof as VM/self-hosted/manual until a reliable runner is attached.

Local validation for the workflow change:
bun run validate:mac-diag-smoke-workflow -> ok
```

CI warning observed but non-fatal: pinned Node 20 actions emit GitHub's Node.js 20 deprecation warning ahead of the June 2, 2026 default Node 24 runner change. This affects existing pinned workflow actions and should be handled as a separate workflow-pinning maintenance task.

## 9b. Follow-up installed-app loading check after user report
After a follow-up report that the installed app still did not load, I closed any stale ROX.ONE processes, opened `/Applications/ROX ONE.app` normally, activated the app window, captured a fresh desktop screenshot, and reran the packaged checks against the installed bundle.

```text
pkill -f "/Applications/ROX ONE.app/Contents/MacOS/ROX.ONE" || true
open -a "/Applications/ROX ONE.app"

ROX_MAC_APP_PATH="/Applications/ROX ONE.app" bun run electron:ui-smoke:packaged:mac
[ui-smoke] account tabs/forms OK
[ui-smoke] experience six-tab navigation OK
[ui-smoke] composer primary and overflow quick actions OK
[ui-smoke] packaged ROX.ONE UI smoke passed; evidence: /Users/marklindgreen/.ai-agent-hub/evidence/playwright-smoke/rox-one-ui-smoke-2026-05-19T16-28-47-418Z

ROX_MAC_APP_PATH="/Applications/ROX ONE.app" bun run electron:smoke:packaged:mac
[packaged-smoke] ROX.ONE packaged headless startup passed
```

Fresh visible-launch evidence was captured at `/Users/marklindgreen/.ai-agent-hub/evidence/playwright-smoke/rox-one-not-loading-20260519T162544Z/screen.png`. The screenshot shows the ROX.ONE window loaded and frontmost with the real user profile.

## 9c. CI contract repair for mac diag Playwright script path
PR #299 exposed a stale workflow-contract assertion after the mac diagnostic
smoke workflow moved the Playwright launcher under `/tmp/pw` so Node can resolve
the ad-hoc `@playwright/test` install. The workflow writes
`/tmp/pw/diag-launch.mjs` and invokes `node /tmp/pw/diag-launch.mjs`, but
`scripts/validate-mac-diag-smoke-workflow.ts` still expected the old
`node /tmp/diag-launch.mjs` path.

This follow-up updates only the validator expectation; it does not change the
runtime workflow behavior or the packaging steps.

Validation:

```text
bun run validate:mac-diag-smoke-workflow
[mac-diag-smoke-workflow] ok: Sonoma/Sequoia diag smoke workflow is wired; Ventura proof remains VM/self-hosted

git diff --check
```

## 9d. CI payload bootstrap for macOS cross-platform launch
PR #299 also exposed that `cross-platform-launch.yml` was packaging on a clean
macOS runner without first populating the gitignored Rox Design runtime payload.
The macOS package script correctly failed fast in `rox-design:payload:verify`
because `apps/electron/resources/rox-design/MANIFEST.json` was absent.

This follow-up adds a macOS-only CI bootstrap before packaging:

- download pinned `open-design-0.7.0-mac-arm64.zip` from
  `nexu-io/open-design`;
- verify the upstream `.sha256` checksum with `shasum -a 256 -c`;
- extract `Open Design.app/Contents/Resources`;
- run `ROX_DESIGN_SOURCE_RESOURCES=... bun run rox-design:prepare -- --force`;
- run `bun run rox-design:payload:verify` before build/package smoke.

The cross-platform workflow validator now also asserts that payload preparation
happens before the macOS package step, so the clean-runner failure cannot return
silently.

Validation:

```text
bun run validate:cross-platform-launch-workflow
[cross-platform-launch-workflow] ok: desktop launch workflow + packaged smoke contracts are wired

bun run validate:ci
validate:ci passed end to end:
- workflow contract validators passed;
- typecheck:all passed;
- shared model/config/doc-tool tests passed;
- audit smoke passed with 0 findings;
- i18n parity, sorted-locale, and coverage checks passed.

git diff --check
```

## 9e. Quit orchestration type contract repair after current-main rebase
After rebasing the CI unblock branch onto current `origin/main`, the full
validation gate exposed a TypeScript-only mismatch between the Rox Design
runtime manager and the shutdown orchestrator test seam:

```text
src/main/index.ts(1402,7): error TS2322: Type 'RoxDesignRuntimeManager | null'
is not assignable to type '_RoxDesignRuntimeManagerLike | null | undefined'.
```

The runtime manager's `stop()` method returns a `RoxDesignStatus`, while the
quit orchestrator only cares that the cleanup promise resolves or rejects. The
structural shutdown dependency now accepts a status-returning stop method and
wraps the registered handler so `QuitOrchestrator` still records a void cleanup.

Validation:

```text
bun test apps/electron/src/main/__tests__/rox-design-view-manager.partition.test.ts \
  apps/electron/src/renderer/components/onboarding/__tests__/OnboardingPromptModal.rtl.test.tsx \
  apps/electron/src/shared/__tests__/ipc-channels.test.ts \
  apps/electron/src/transport/__tests__/channel-map-parity.test.ts \
  packages/shared/src/protocol/__tests__/routing.test.ts \
  apps/electron/src/main/__tests__/quit-orchestrator.test.ts

34 pass
0 fail

bun run typecheck
```

## 9f. Artifact validator realigned with the Sonoma support floor
After PR #274, the product support contract changed to macOS Sonoma 14.0 and
newer. `README.md`, `docs/release/rox-one-site-handoff.md`, and
`apps/electron/electron-builder.yml` already declare that floor, but
`validate:packaged-artifacts` still expected the older Monterey-compatible
`LSMinimumSystemVersion=12.0`.

The GitHub-hosted macOS Sequoia packaged launch job proved the app now builds,
prepares the Rox Design payload, and passes packaged headless startup. It failed
only at the artifact metadata gate because the validator expected `12.0` while
the generated package correctly carried the current `14.0` floor.

This follow-up updates the validator, validator unit tests, and T537 ticket
metadata so the CI contract matches the current Sonoma-and-newer product
contract.

## 9g. Validate workflow scoped to maintained gates
The GitHub-hosted Validate job passed the maintained `validate:ci` gate, then
failed in an additional bare `bun test` discovery pass. That pass is not the
repo's maintained aggregate gate today: it discovers Playwright visual specs,
historical rebrand fixtures, and stateful filesystem tests together, producing
unrelated failures after `validate:ci` has already completed successfully.

This follow-up keeps the full maintained gate (`validate:ci`) and workflow pin
validation intact, then runs the package-level test that this PR actually
changes:

```text
bun test --timeout=30000 scripts/__tests__/validate-packaged-artifacts.test.ts
```

The broader all-test cleanup should be handled as a separate test-harness
stabilization task, not inside the current PR #330 CI unblock branch.

## 9h. PR #330 validate Playwright browser install repair
The validate workflow installed Playwright browsers through
`./node_modules/.bin/playwright`, which resolves to `@playwright/test` 1.60.0 in
this Bun install. The audit runner imports the direct `playwright` package at
1.55.1, so its headless Chromium launch asks for the 1.55 browser cache entry:
`chromium_headless_shell-1193/chrome-linux/headless_shell`.

Local reproduction used an empty `PLAYWRIGHT_BROWSERS_PATH` and confirmed the
same missing executable path without downloading browsers. The direct
`node_modules/playwright/cli.js install --dry-run --only-shell chromium`
command targets `chromium_headless_shell-1193`, so the validate workflow now
installs the browser artifact used by the package that launches Chromium.

## 9i. CircleCI validate parity repair
After GitHub Actions went green on PR #330 head `c7c801099`, CircleCI
`validate` failed because `.circleci/config.yml` still ran the stale broad
`bun test --timeout=30000` discovery pass that the GitHub Validate workflow had
already replaced with maintained validation gates.

The CircleCI validate job is now aligned with GitHub Actions:

```text
bun run validate:agent-contract
bun run validate:architecture-docs
bun run validate:ci
bun run validate:workflow-pins
bun test --timeout=30000 scripts/__tests__/validate-packaged-artifacts.test.ts
```

`scripts/validate-ci-contract.ts` now also checks CircleCI parity and rejects
reintroducing the stale bare test discovery or `.isolated.ts` discovery loop.
This keeps the CI unblock branch scoped to maintained gates while preserving the
package-level regression test touched by this PR.

## 10. Remaining risks
- Local machine can directly prove only the local macOS ARM64 artifact; PR CI now proves macOS Sequoia ARM64 packaged launch and diagnostic smoke proves Sonoma/Sequoia on GitHub-hosted runners. Monterey/Ventura are no longer supported release targets after the Sonoma 14.0 floor change.
- GitHub-hosted Windows runners are Windows Server images, not literal Windows 10/11 consumer desktops. They now prove Windows x64 Electron packaging/startup class on `windows-latest` and `windows-2022`, not the exact consumer SKU UX.
- Ubuntu 22.04 and 24.04 packaged launch are proven in PR CI under Xvfb. Debian/Fedora/NixOS entries in this change are launcher/static guard coverage unless a real distro VM/self-hosted runner is attached.
- Public production distribution remains unsigned/notarization dependent per existing release readiness docs; this task does not procure Apple Developer ID, Authenticode, or Linux GPG production signing credentials.

## 11. Acceptance criteria matrix
| Criterion | Status | Evidence |
| --- | --- | --- |
| Renderer chunk crash fixed | Passing locally | Exact package matching in `vite.config.ts`; `validate:renderer-chunks` reports 341 chunks checked. |
| Circular chunk regression guarded | Passing locally | `scripts/validate-renderer-chunks.isolated.ts` rejects React/i18n cycle; renderer build fails on `Circular chunk:`. |
| macOS white-window diagnostic workflow | Passing macos-14/15; pre-Sonoma external | `mac-diag-smoke.yml` captures screenshot/log/crash artefacts on Sonoma and Sequoia; `scripts/validate-mac-diag-smoke-workflow.ts` guards the runner matrix and keeps pre-Sonoma proof out of the supported release floor. |
| macOS Sonoma+ floor pinned | Passing local + remote CI | `electron-builder.yml` sets `minimumSystemVersion: "14.0"`; local and Sequoia PR CI packaged validators print `LSMinimumSystemVersion=14.0`. |
| Packaged macOS launch smoke | Passing locally | `electron:smoke:packaged:mac` and generic `electron:smoke:packaged` both report packaged headless startup passed. |
| Packaged macOS UI leaves loader | Passing locally | `electron:ui-smoke:packaged:mac` passed; evidence dir `/Users/marklindgreen/.ai-agent-hub/evidence/playwright-smoke/rox-one-ui-smoke-rebuilt-20260519T153804Z`. |
| Windows packaged launch harness | Passing remote CI | PR CI passed packaged build, unpacked smoke, NSIS package, and artifact validation on `windows-latest` and `windows-2022`. |
| Ubuntu packaged launch harness | Passing remote CI | PR CI passed packaged launch under Xvfb plus AppImage/deb/rpm packaging and artifact validation on Ubuntu 22.04 and 24.04. |
| Debian/Fedora/NixOS launcher support | Passing remote guard CI | PR CI passed distro launcher guards for `debian:12`, `fedora:40`, and `nixos/nix`; full GUI launch still needs VM/self-hosted runner proof. |
| CI guard wired into local gate | Passing locally | `bun run validate:ci` passed after ticket metadata repair. |
