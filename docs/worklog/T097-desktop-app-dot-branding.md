# T097 - Desktop App Dot Branding Worklog

## 1. Task summary

Finish the desktop app identity follow-up that was left in the working tree:
packaged and dev Electron names should be `ROX.ONE`, not `ROX ONE`, while
historical docs and update artifact filenames stay unchanged.

## 2. Red evidence

The partial rename changed runtime brand config before updating expectations:

```bash
bun test packages/shared/src/__tests__/branding.test.ts
bun test apps/electron/src/renderer/pages/settings/__tests__/account-brand-summary.test.ts
```

Result: FAIL.

- `branding.test.ts` still expected `legalName: 'ROX ONE'`.
- `account-brand-summary.test.ts` still expected `Legal entity` description
  `ROX ONE`.

## 3. Implementation changes

- Kept the existing `ROX.ONE` changes in:
  - `apps/electron/electron-builder.yml`
  - `apps/electron/scripts/afterPack.cjs`
  - `apps/electron/src/main/index.ts`
  - `packages/shared/src/branding.ts`
  - `scripts/electron-dev.ts`
- Updated focused tests to expect `ROX.ONE` legal-name display.
- Updated the main BrowserWindow default title to `ROX.ONE`.
- Updated packaged smoke/build scripts and the mac ARM workflow contract to use
  `apps/electron/release/mac-arm64/ROX.ONE.app` and `Contents/MacOS/ROX.ONE`.
- Updated macOS/Windows installer app-name and process-path assumptions.

## 4. Validation commands

| Command | Result | Evidence |
|---|---|---|
| `bun test packages/shared/src/__tests__/branding.test.ts` | PASS | 5 pass, 0 fail |
| `bun test apps/electron/src/renderer/pages/settings/__tests__/account-brand-summary.test.ts` | PASS | 2 pass, 0 fail |
| `bun run validate:mac-arm-build-workflow` | PASS | `[mac-arm-build-workflow] ok` |
| `bun run typecheck:all` | PASS | aggregate typecheck exited 0 |
| `bun run lint` | PASS | aggregate lint exited 0 |
| `bun run validate:docs` | PASS | 11 skills, 98 tickets, 7 required docs |
| `git diff --check` | PASS | no whitespace errors |
| `bun run electron:smoke` | PASS | `CRAFT_SERVER_URL=`, `App initialized successfully`, and `[smoke] Electron headless startup passed` observed in GUI-capable execution |

## 5. Remaining risks

- Existing packaged release artifacts were not regenerated in this slice; the
  source/workflow path is ready for the next package build, but checked-in
  release binaries remain local artifacts outside git.
- Historical docs, localized UI copy, and update artifact filenames can still
  say `ROX ONE` or `ROX-ONE` where they refer to human product text or existing
  release files.
