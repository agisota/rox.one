# T200 - Clear dependency security alerts

## 1. Task summary

GitHub Dependabot reported vulnerable ranges for `@anthropic-ai/sdk`, `playwright`, `happy-dom`, and `beautiful-mermaid`. This task updates the manifest ranges and lockfile, then reruns the full quality gate and packaged app smoke.

## 2. Repo context discovered

- `packages/audit/package.json` pinned `@anthropic-ai/sdk` to `0.81.0` and `playwright` to `1.49.1`.
- `apps/electron/package.json` used `happy-dom` range `^15`.
- `packages/ui/package.json` and `packages/session-tools-core/package.json` used `beautiful-mermaid` range `*`.
- `bun.lock` also contained a transitive `@anthropic-ai/sdk@0.81.0` via `@anthropic-ai/claude-agent-sdk`, so a root override was needed to avoid leaving a vulnerable copy in the resolved graph.

## 3. Files inspected

- `package.json`
- `bun.lock`
- `apps/electron/package.json`
- `packages/audit/package.json`
- `packages/ui/package.json`
- `packages/session-tools-core/package.json`

## 4. Tests added first

No new tests were added. This is a dependency remediation task; existing type, unit, RTL, E2E, audit, build, and packaged smoke coverage exercises the affected surfaces.

## 5. Expected failing test output

After bumping `playwright`, `cd packages/audit && bun test` initially failed because the matching browser cache was missing:

```text
Executable doesn't exist at .../chromium_headless_shell-1193/chrome-mac/headless_shell
Please run the following command to download new browsers: npx playwright install
```

## 6. Implementation changes

- Updated `@anthropic-ai/sdk` in `packages/audit` to `0.91.1`.
- Updated `playwright` in `packages/audit` to `1.55.1`.
- Updated `happy-dom` in `apps/electron` to `^20.8.9` (resolved to `20.9.0`).
- Replaced `beautiful-mermaid` wildcard ranges with `^1.1.3` in shared workspace packages.
- Added a root `overrides` entry for `@anthropic-ai/sdk: 0.91.1` so transitive workspace resolution does not keep `0.81.0`.
- Regenerated `bun.lock`.
- Installed the matching Playwright Chromium cache with `cd packages/audit && bun x playwright install chromium`.

## 7. Validation commands run

- `bun install --frozen-lockfile`
- `bun run typecheck:all`
- `bun run lint`
- `bun run test:rtl`
- `cd packages/audit && bun test`
- `bun run e2e:core`
- `bun run validate:audit`
- `bun run build`
- `bun run electron:dist:dev:mac:arm64`
- `bun run electron:smoke:packaged:mac`
- `bun run electron:ui-smoke:packaged:mac`
- `bun run validate:packaged-artifacts`

## 8. Passing test output summary

- RTL: 9 files, 54 tests passed.
- Audit package: 86 tests passed.
- E2E core: composer artifacts, Experience runtime, account/team/billing/storage, server smoke, and Electron startup smoke passed.
- Audit smoke: static-tsc and bundle checks for webui/viewer/marketing reported 0 findings.
- Packaged UI smoke passed with evidence at `/Users/marklindgreen/.ai-agent-hub/evidence/playwright-smoke/rox-one-ui-smoke-2026-05-12T23-21-20-770Z`.

## 9. Build output summary

- `bun run build` passed.
- `bun run electron:dist:dev:mac:arm64` produced `ROX-ONE-arm64.dmg`, `ROX-ONE-arm64.zip`, blockmaps, and `latest-mac.yml`.
- Final artifact hashes:
  - DMG: `347785dd817a5324ed73c8d1fa682772e2f68613e51a69c2bedc4e1b941c6ffc`
  - ZIP: `8d301fe23e23a68f408d13c1934cfee0b02cc4f69a6d5a759866f188d9b1894a`

## 10. Remaining risks

- The packaged build is ad-hoc signed and not notarized in local dev mode.
- Vite still reports large chunk warnings; this is pre-existing and covered by audit bundle smoke.
- GitHub Dependabot alert status may take time to refresh after push.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| Fixed vulnerable dependency ranges | Pass | Package manifests and `bun.lock` updated |
| No vulnerable old versions remain in lockfile | Pass | `rg '@anthropic-ai/sdk@0\\.81|playwright@1\\.49|happy-dom@15|beautiful-mermaid@0\\.' bun.lock ...` returned no matches |
| Full quality gate passes | Pass | Validation commands in section 7 |
| Packaged ROX.ONE smoke passes | Pass | Packaged startup and UI smoke passed |

