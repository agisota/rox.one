# T536 — Auto-update channels and live release feed worklog

## 1. Task summary

Implement ROX.ONE auto-update completion: stable/beta update channels, default background download, manual download/install controls, TopBar update CTA, remote release notes, Cloudflare release-feed channel routing, release workflow metadata validation, and live publishing verification.

## 2. Repo context discovered

- Repository: `/Users/marklindgreen/Projects/rox-one-terminal-t302-live`
- Branches: initial implementation on `mac/t302-release-update-live`, live follow-up on `mac/t302-marketing-release-live-fix`
- Remote: `https://github.com/agisota/rox-one-terminal.git`
- Baseline: initial feature from `origin/main` at `c14cc785ba235fd4a0d97a7cb5c83a23b8c0f2f9`; live follow-up reset to `origin/main` at merge commit `6fa99c69cc5eca0b2a09936c904e6ffee21c7ae4`
- Top-level repo contract requires ticket/worklog first and tests/validation before implementation.
- `electron-updater` was already present, but the live feed contract was incomplete: stable/beta YAML metadata and release notes needed to be emitted, validated, and served by `app.rox.one`.
- `apps/electron/resources/AGENTS.md` says feature commits must update `release-notes/next.md`, not create versioned release-note files. The temporary `1.0.0*.md` files were removed and folded into `next.md`; versioned files remain a release-prep responsibility.
- Hosted validate exposed an existing Linux artifact fixture mismatch: the validator correctly expects Debian `amd64` naming while the synthetic test fixture still wrote `x86_64.deb`; the fixture was aligned with electron-builder Debian naming.
- Live follow-up found `/electron/beta/manifest.json` still resolving old `v1.0.0-rc.7`, whose release lacked `beta*.yml`; the Worker must skip beta/rc releases that are not GitHub prereleases or that lack mandatory beta update metadata.

## 3. Files inspected

- `.github/workflows/release-all-platforms.yml`
- `apps/electron/electron-builder.yml`
- `apps/electron/src/main/auto-update.ts`
- `apps/electron/src/main/handlers/system.ts`
- `apps/electron/src/main/__tests__/auto-update.signature.test.ts`
- `apps/electron/src/renderer/hooks/useUpdateChecker.ts`
- `apps/electron/src/renderer/components/app-shell/TopBar.tsx`
- `apps/electron/src/renderer/components/app-shell/AppShell.tsx`
- `apps/electron/src/renderer/pages/settings/AppSettingsPage.tsx`
- `apps/electron/src/shared/types.ts`
- `apps/electron/src/shared/__tests__/ipc-channels.test.ts`
- `apps/electron/src/transport/channel-map.ts`
- `apps/marketing/src/App.tsx`
- `apps/webui/src/adapter/web-api.ts`
- `infra/cloudflare/rox-one-release-feed.worker.ts`
- `infra/__tests__/rox-one-release-feed-worker.test.ts`
- `packages/shared/src/config/storage-settings.ts`
- `packages/shared/src/config/storage-io.ts`
- `packages/shared/src/config/config-defaults-schema.ts`
- `packages/shared/src/protocol/channels.ts`
- `packages/shared/src/protocol/dto.ts`
- `packages/shared/src/protocol/routing.ts`
- `packages/shared/src/i18n/locales/*.json`
- `scripts/validate-release-all-platforms-workflow.ts`
- `scripts/validate-release-feed-assets.ts`
- `scripts/validate-release-notes-feed.ts`
- `scripts/__tests__/validate-packaged-artifacts.test.ts`
- `scripts/stamp-release-version.ts`
- Live follow-up: GitHub PR/release/action state via `gh`, `https://app.rox.one/electron/*` feed URLs via `curl -I`, and `https://rox.one/` deployed bundle markers.

## 4. Tests added first

- `apps/electron/src/main/__tests__/auto-update.signature.test.ts`
  - update-channel/default auto-download behavior.
  - manual check with auto-download disabled.
  - explicit `downloadUpdate()` path.
  - `canInstall=true` broadcast when `update-downloaded` transitions to `ready`.
  - runtime payload hardening for invalid update settings before feed configuration.
- `apps/electron/src/shared/__tests__/ipc-channels.test.ts`
  - update IPC channel count/wire-format coverage.
- `infra/__tests__/rox-one-release-feed-worker.test.ts`
  - `/electron/latest` stable alias.
  - `/electron/stable` latest metadata.
  - `/electron/beta` beta/rc metadata.
  - `/electron/{version}` pinned version routing.
  - `release-notes.json` and install script routing.
  - CORS/HEAD/security behavior.
  - Live follow-up regression: skip old or incomplete beta/rc releases so `/electron/beta/beta*.yml` cannot resolve to a release without required update metadata.
- `scripts/validate-release-all-platforms-workflow.ts`
  - release workflow must stamp package version from tag, validate YAML/assets, publish `manifest.json` + `release-notes.json`, and keep platform releases draft until final attach.
- `scripts/validate-release-feed-assets.ts`
  - stable requires `latest-mac.yml`, `latest.yml`, `latest-linux.yml`; beta requires `beta-mac.yml`, `beta.yml`, `beta-linux.yml`.
- `scripts/validate-release-notes-feed.ts`
  - generated release notes feed must match expected version/channel and include content.
- `scripts/__tests__/validate-packaged-artifacts.test.ts`
  - Linux packaged-artifact fixture must match electron-builder Debian/RPM naming.

## 5. Expected failing test output

Before implementation/fixup, the added checks exposed two local failures:

```text
Expected: true
Received: false
```

for `broadcasts canInstall=true when the downloaded update is ready`, because some `updateInfo` event transitions bypassed derived-field refresh before broadcast.

```text
[release-all-platforms-workflow] package.json missing script: release:stamp-version
```

for the workflow contract, because the validator had been extended before the version-stamping script and package script were implemented.

## 6. Implementation changes

- Electron main update service:
  - added persisted update settings (`autoDownloadUpdates`, `updateChannel`) and safe stable/beta feed configuration.
  - added `update:download`, settings IPC, manual download URL, release notes URL, `canInstall`, and install fallback fields.
  - ensured all update broadcasts pass through derived-field refresh so `canInstall`, feed channel, manual URL, and release notes URL stay current.
  - hardened runtime settings payloads so invalid renderer input cannot configure arbitrary update channels.
- Renderer/UI:
  - added TopBar orange update CTA/progress/download/install states.
  - added app settings controls for automatic download, beta participation, current channel/version, manual check/download/install, and manual fallback link.
  - `useUpdateChecker()` now exposes settings, manual download, and ready/install states.
  - `What’s New` reads the selected channel’s remote `release-notes.json` first and falls back to bundled release notes when offline/unavailable.
  - added `release-notes/next.md` entry instead of committing versioned `1.0.0*.md` files.
- Shared config/protocol:
  - added defaults, storage schema, IPC channels/routes/types for update settings/download.
  - updated i18n parity for all locales.
- Release infrastructure:
  - workflow now supports stable `vX.Y.Z` and beta `vX.Y.Z-beta.N` / transitional `vX.Y.Z-rc.N` tags.
  - release builds stamp package versions from the tag before install/build and run `check-version`.
  - electron-builder emits channel-aware update metadata for all channels.
  - publish job validates required YAML/assets before building `manifest.json`.
  - final attach includes `manifest.json`, `release-notes.json`, install scripts, and only then flips the GitHub Release out of draft.
  - added feed validators and version-stamping script.
- Cloudflare Worker:
  - `/electron/latest` aliases stable.
  - `/electron/stable`, `/electron/beta`, `/electron/{version}` route to correct GitHub Release assets.
  - beta selection now requires a real GitHub prerelease and all mandatory beta metadata assets: `manifest.json`, `beta-mac.yml`, `beta.yml`, `beta-linux.yml`.
  - install scripts and `release-notes.json` are served from release assets.
- CI validation fixture:
  - aligned Linux `.deb` fixture naming with electron-builder Debian `amd64` output so the existing packaged-artifact validator passes on hosted Linux.
- Marketing site:
  - download cards read stable/beta manifests and stable release notes from `app.rox.one` instead of relying on hardcoded versions.
  - shows the unsigned Apple Developer ID warning.
  - live follow-up tightened the beta-card guard from `betaDownloads.length > 0` to `betaDownloads[0]` so strict TypeScript sees the rendered first beta download as defined.

## 7. Validation commands run

- `git fetch origin --prune` — confirmed branch is aligned with `origin/main` before the handoff branch work.
- `bun test apps/electron/src/main/__tests__/auto-update.signature.test.ts --test-name-pattern 'broadcasts canInstall'` — pass.
- `bun test apps/electron/src/main/__tests__/auto-update.signature.test.ts --test-name-pattern 'invalid runtime update settings'` — pass.
- `bun run validate:release-all-platforms-workflow` — pass.
- `bun test apps/electron/src/main/__tests__/auto-update.signature.test.ts apps/electron/src/shared/__tests__/ipc-channels.test.ts apps/electron/src/transport/__tests__/channel-map-parity.test.ts` — pass.
- `bun test infra/__tests__/rox-one-release-feed-worker.test.ts` — pass.
- `bun run typecheck:electron` — pass.
- `bun test scripts/__tests__/validate-packaged-artifacts.test.ts --test-name-pattern 'unsigned Linux validation without AppImage signature sidecar'` — pass after fixture correction.
- `bun test scripts/__tests__/validate-packaged-artifacts.test.ts` — pass.
- `bun run lint:i18n:parity && bun run lint:i18n:sorted && bun run lint:i18n:coverage` — pass.
- `bun run typecheck:all` — pass.
- `bun run marketing:build` — pass.
- `bun run electron:build` — pass with existing Vite chunk-size/dynamic-import warnings.
- `gh pr view 256 --repo agisota/rox-one-terminal --json state,mergedAt,mergeCommit,url,title` — PR merged at `2026-05-19T08:32:50Z`, merge commit `6fa99c69cc5eca0b2a09936c904e6ffee21c7ae4`.
- `gh run view 26086129899 --repo agisota/rox-one-terminal --json status,conclusion,workflowName,headBranch,headSha,url` — `Release All Platforms` completed with `success` on tag `v1.0.0`.
- `gh release view v1.0.0 --repo agisota/rox-one-terminal --json ...` — published stable release contains `manifest.json`, `release-notes.json`, `latest*.yml`, `beta*.yml`, install scripts, mac/win/linux binaries.
- `curl -L -sS -I https://app.rox.one/electron/stable/{manifest.json,latest-mac.yml,latest.yml,latest-linux.yml,release-notes.json,install-app.sh,install-app.ps1,...}` — stable manifest/metadata/scripts/assets returned `200`.
- `curl -L -sS https://app.rox.one/electron/stable/manifest.json` and `/electron/latest/manifest.json` — both returned version `1.0.0`, channel `stable`.
- `curl -L -sS -I https://app.rox.one/electron/beta/beta-mac.yml` before the live follow-up fix returned `404`; regression test added to prevent the Worker from selecting an old incomplete rc release.
- `bun test infra/__tests__/rox-one-release-feed-worker.test.ts` — pass after beta selection guard (`24 pass`, `0 fail`).
- `bun run --cwd apps/marketing typecheck` — pass after beta-card guard.
- `bun run --cwd apps/marketing build` — pass after beta-card guard.

## 8. Passing test output summary

- Auto-update + IPC/channel tests: `53 pass`, `0 fail`, `1244 expect() calls`.
- Worker tests: initial implementation `23 pass`, `0 fail`, `79 expect() calls`; live follow-up `24 pass`, `0 fail`, `83 expect() calls`.
- i18n parity: `7 locales, 1614 keys each`.
- i18n coverage: `1541 literal references, 1160 files scanned`.
- Workflow validator: `[release-all-platforms-workflow] ok: update-feed workflow contract passed`.

## 9. Build output summary

- `bun run marketing:build` and live follow-up `bun run --cwd apps/marketing build` completed successfully; Vite built `apps/marketing/dist`.
- `bun run electron:build` completed successfully:
  - main process built and verified.
  - preload entries built and verified.
  - renderer built successfully.
  - resources copied into `apps/electron/dist/resources`.
- Known non-blocking build warnings observed:
  - Vite dynamic import warnings for Shiki language/theme packages.
  - Rollup circular chunk warnings.
  - large chunk size warnings.

## 10. Remaining risks

- Stable `v1.0.0` live verification is complete; beta channel live proof still requires publishing a fresh prerelease tag that contains `beta*.yml`, then redeploying the Worker with the beta selection guard.
- Release workflow asset validation is string/contract based plus unit-tested worker behavior; a fresh beta tag run will be the live proof for beta update metadata.
- Unsigned macOS builds may require manual Gatekeeper action even when update download/install code is correct.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| Stable feed exposes required update metadata | Live green | `v1.0.0` GitHub Release contains `latest-mac.yml`, `latest.yml`, `latest-linux.yml`; `app.rox.one/electron/stable/*` returned `200`. |
| Beta feed exposes required update metadata | Regression fixed, live beta release pending | Worker now skips old/incomplete rc releases; fresh beta tag must be published so `/electron/beta/beta*.yml` has live `200`. |
| `/electron/latest` aliases stable, not rc/beta | Live green | `/electron/latest/manifest.json` and `/electron/stable/manifest.json` both returned version `1.0.0`, channel `stable`; Worker regression test remains green. |
| App auto-downloads updates by default | Local test green | Auto-update settings test expects `autoDownloadUpdates: true` and `autoUpdater.autoDownload=true`. |
| App can manually check/download/install when auto-download is off | Local test green | Auto-update tests cover manual check idle state, `downloadUpdate()`, and `installUpdate()`. |
| TopBar shows non-blocking update button/progress | Implemented, build green | `TopBar.tsx`; `typecheck:electron` and `electron:build` pass. Visual live proof pending packaged app. |
| Settings expose auto-download and beta participation | Implemented, build green | `AppSettingsPage.tsx`; i18n parity/coverage and Electron build pass. |
| Remote «Что нового» feed with local fallback works | Implemented, build green | `AppShell.tsx` fetches channel release notes URL and falls back to `getReleaseNotes()`. |
| Release workflow validates required assets | Local validator green | `bun run validate:release-all-platforms-workflow` pass. |
| Real `rox.one` download surface reads live feed | Deployed, final visual proof pending | Deployed `rox.one` bundle contains `app.rox.one/electron/stable`, `app.rox.one/electron/beta`, and stable release-notes URLs; Playwright screenshot remains pending. |
| Live URLs verified after deploy | Stable green, beta pending fresh prerelease | Stable/latest URLs returned `200`; old beta rc metadata returned `404`, fixed in Worker selection logic and pending fresh beta release. |
| Installed app update verified | Pending external stage | Requires published newer release and live feed. |
