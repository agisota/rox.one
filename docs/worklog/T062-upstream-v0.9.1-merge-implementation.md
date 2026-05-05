# T062 - Upstream v0.9.1 Merge Implementation Worklog

## 1. Task summary

Merge upstream `v0.9.1` into `mac/upstream-v0.9.1-rox-merge` with protected
conflict resolution for ROX-owned product layers.

## 2. Repo context discovered

Pre-merge red checks:

```text
ticket-missing
worklog-missing
ancestor_status=1
HEAD...v0.9.1 = 103 local / 4 upstream
```

T061 confirmed upstream source:

```text
b31904c60b3a48f7deb310518e04b9200397af6d refs/tags/v0.9.1
```

T061 also confirmed the merge dry-run is conflict-heavy across package, lock,
CI, CLI, server runtime, settings, and i18n surfaces.

## 3. Files inspected

- `docs/release/upstream-v0.9.1-rox-protected-map.md`
- `package.json`
- `bun.lock`
- `.github/workflows/`
- `apps/cli/`
- `apps/electron/`
- `packages/shared/`
- `packages/server-core/`
- `apps/electron/src/renderer/components/workbench/`
- `apps/electron/src/renderer/pages/settings/`
- `packages/shared/src/i18n/`

## 4. Tests added first

This ticket begins with validation checks rather than new unit tests because the
change is a repository integration merge. The failing controls before merge:

```text
test -f docs/tickets/T062-upstream-v0.9.1-merge-implementation.md -> missing
test -f docs/worklog/T062-upstream-v0.9.1-merge-implementation.md -> missing
git merge-base --is-ancestor v0.9.1 HEAD -> ancestor_status=1
```

Post-merge validation matrix:

```bash
bun run validate:agent-contract
bun run validate:docs
bun run typecheck:all
bun test
bun run lint:i18n:parity
bun run e2e:core
bun run electron:build
git diff --check
```

## 5. Expected failing test output

Before implementation, `v0.9.1` is not an ancestor of the branch and T062 has no
canonical ticket/worklog:

```text
ticket-missing
worklog-missing
ancestor_status=1
```

## 6. Implementation changes

Merged upstream `v0.9.1` on `mac/upstream-v0.9.1-rox-merge` and resolved
conflicts across package metadata, Bun lockfile, CLI provider routing, Electron
main/preload/renderer paths, server runtime handlers, messaging gateway, i18n
locale files, and build scripts.

Protected ROX layers were kept in place:

```text
apps/electron/src/renderer/components/workbench/
apps/electron/src/renderer/pages/settings/
apps/electron/src/main/account-api.ts
packages/shared/src/workbench/
packages/shared/src/i18n/
packages/server-core/src/webui/
packages/server-core/src/sync/
docs/tickets/
docs/worklog/
docs/release/
.swarm/
```

Important merge repairs:

- Preserved ROX package metadata while accepting upstream `0.9.1` dependency and
  workspace changes.
- Preserved ROX account/settings and Workbench surfaces while accepting upstream
  Electron shell, messaging, browser, markdown, release notes, and Pi runtime
  updates.
- Restored renderer draft refs after the `App.tsx` merge.
- Added CI-safe i18n literal coverage scanning for `t(...)`, `i18n.t(...)`, and
  `<Trans i18nKey=...>` callsites.
- Updated docs validation fixtures so generated tickets include `Status: TODO`.
- Guarded markdown/code-viewer custom-element registration for non-browser test
  environments.
- Mocked PDF viewer dependencies in mention menu tests so Bun tests do not rely
  on browser-only `DOMMatrix`.
- Restored global `fetch` in OAuth relay/callback tests.
- Skipped the Postgres account-store integration test unless explicit Postgres
  environment variables are present.
- Updated Electron resource staging to reuse the new SDK copy helpers. Upstream
  `@anthropic-ai/claude-agent-sdk@0.2.123` ships a thin `sdk.mjs` package plus a
  native per-platform binary package, so the old `cli.js` verification path was
  removed in favor of staging `claude-agent-sdk-binary`.

## 7. Validation commands run

```bash
bun run validate:agent-contract
bun run validate:docs
bun run typecheck:all
bun test
bun run validate:ci
bun run electron:build:resources
bun run electron:build
bun run lint:i18n:parity
bun run e2e:core
git diff --check
test -d apps/electron/src/renderer/components/workbench
test -d apps/electron/src/renderer/pages/settings
test -f apps/electron/src/main/account-api.ts
test -d packages/shared/src/workbench
test -d packages/shared/src/i18n
test -d packages/server-core/src/webui
test -d packages/server-core/src/sync
```

## 8. Passing test output summary

```text
bun test
4625 pass
13 skip
0 fail
1 snapshots, 11705 expect() calls
Ran 4638 tests across 381 files.
```

```text
bun run validate:ci
validate:agent-contract OK
validate:architecture-docs OK
validate:ci-contract OK
validate:dev OK
i18n parity OK (7 locales, 1547 keys each)
i18n locale keys sorted
i18n coverage OK (1478 literal refs, 995 files scanned)
```

```text
bun run e2e:core
composer-artifacts: pass
account-team-billing-storage: pass
server-smoke: pass
electron-startup-smoke: pass
all core scenarios passed
```

## 9. Build output summary

`bun run electron:build` passes. The initial post-merge build failed because
`scripts/electron-build-resources.ts` still expected `cli.js` inside
`@anthropic-ai/claude-agent-sdk`; upstream now stages the native binary from the
platform package. After wiring the script to `copySDK()` and `verifySDKCopy()`,
resource staging verified:

```text
Staging SDK native binary (claude-agent-sdk-darwin-arm64) as claude-agent-sdk-binary alias...
SDK copy verified: native binary is 205.9 MB
```

Renderer production build completed with Vite chunk-size warnings only; no build
errors.

## 10. Remaining risks

- This is a broad upstream merge and should not be merged into `main` until the
  next account/share runtime tickets re-check production-facing flows.
- Signed/notarized production release was not run in T062.
- Real external provider flows were not exercised; tests use deterministic fake
  providers where applicable.
- `events.jsonl` is a runtime artifact modified by smoke startup and is
  intentionally excluded from the merge commit.

## 11. Acceptance criteria matrix

| Criteria | Status | Evidence |
|---|---|---|
| `v0.9.1` ancestor after merge | PASS | Verified after merge commit. |
| ROX protected surfaces preserved | PASS | Protected path existence check passed. |
| `validate:agent-contract` passes | PASS | Included in `validate:ci`; also run directly. |
| `validate:docs` passes | PASS | Run directly. |
| `typecheck:all` passes or blocker documented | PASS | `bun run typecheck:all` passed. |
| `bun test` passes or blocker documented | PASS | 4625 pass, 13 skip, 0 fail. |
| `lint:i18n:parity` passes or blocker documented | PASS | 7 locales, 1547 keys each. |
| `e2e:core` passes or blocker documented | PASS | 4 fake-provider core scenarios passed. |
| `electron:build` passes or blocker documented | PASS | Main, preload, renderer, resources, and assets built. |
| `git diff --check` passes | PASS | No whitespace errors. |
