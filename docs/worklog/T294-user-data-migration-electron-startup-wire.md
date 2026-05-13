# T294 - User-data migration Electron startup wire

Status: DONE
Phase: R.8 (closeout)
Ticket: docs/tickets/T294-user-data-migration-electron-startup-wire.md
Spec: docs/superpowers/specs/2026-05-13-user-data-migration-design.md

## 1. Task summary

Wire `migrateUserDataIfNeeded()` into the Electron main process so the
R.8 user-data migration runs once at startup, **before** any storage
seeder that would call `ensureConfigDir()` and materialize an empty
`~/.rox/` directory (which would trip the conflict branch).

T294 is also the R.8 closeout — its commit appends the R.8 ledger line
to `.swarm/master-roadmap-log.md`.

## 2. Repo context discovered

- The Electron main-process bootstrap is `apps/electron/src/main/index.ts`.
  `app.whenReady().then(async () => { ... })` opens around line 382 of
  the pre-T294 head.
- The first storage seeder inside that block is `initializeDocs()` at
  line 421 (now shifted). All seeders downstream (`initializeReleaseNotes`,
  `ensureDefaultPermissions`, `ensureToolIcons`, `ensurePresetThemes`)
  transitively call `ensureConfigDir()` and would create `~/.rox/` if
  it did not already exist.
- The existing `paths.ts` auto-migration (lines 19–31) fires on the
  *first* `getConfigDir()` call anywhere in the import graph. In
  practice that is also inside `app.whenReady` (via the imports of
  `setBundledAssetsRoot` and `initializeDocs`), so the new shim runs
  before the legacy block has a chance to fire. The two layers are
  defense-in-depth — the marker file makes both safe to run in
  sequence.

## 3. Files inspected

- `apps/electron/src/main/index.ts` (entire `app.whenReady` block).
- `packages/shared/src/config/storage-io.ts` (`ensureConfigDir` body).
- `apps/electron/src/main/__tests__/init-gate.test.ts` (test-shape
  reference for lightweight Electron-main tests).
- `apps/electron/src/main/__tests__/session-branch-rollback.isolated.ts`
  (heavyweight mock-driven harness reference — not used here).
- `scripts/__tests__/r7-docker-ci-build.test.ts` (string-order
  regression-test shape reference).

## 4. Tests added first

`apps/electron/src/main/__tests__/user-data-migration-startup.test.ts`
holds four assertions:

1. The `@rox-one/shared/config` barrel re-exports
   `migrateUserDataIfNeeded` as a function. Proves the import path the
   wire depends on actually resolves.
2. `apps/electron/src/main/index.ts` imports
   `migrateUserDataIfNeeded` from `@rox-one/shared/config` (regex on
   the import statement, tolerant of the symbol appearing either alone
   or alongside other named imports from the same module).
3. The migration call site lives after `app.whenReady().then(` opens
   AND before every storage seeder that depends on `ensureConfigDir()`:
   `initializeDocs()`, `initializeReleaseNotes()`,
   `ensureDefaultPermissions()`, `ensureToolIcons(DEFAULT_LOCAL_SCOPE)`,
   `ensurePresetThemes(DEFAULT_LOCAL_SCOPE)`.
4. The migration is invoked exactly once (guards against a future
   refactor that accidentally double-wires the call).

The string-order assertion follows the same shape used by the R.7
`r7-docker-ci-build.test.ts` electron-builder contract — it reads the
file as text and checks `indexOf` positions, which is cheap, robust,
and does not require mocking Electron's `app` object.

## 5. Expected failing test output

Run on the pre-wire HEAD (no import, no call site):

```
(fail) ...migrateUserDataIfNeeded runs before any storage seeder
expect(received).toBeGreaterThan(-1)  // callPos === -1
```

The first two assertions also failed: the barrel export was missing
until T293 landed, and the import statement was absent until T294
landed.

## 6. Implementation changes

`apps/electron/src/main/index.ts`:

- Line 87 — extended the existing shared/config named-import to
  include `migrateUserDataIfNeeded`. No new import line added.
- Lines 420–426 — inserted the migration call inside
  `app.whenReady().then(async () => { ... })`, immediately after
  `setPowerShellValidatorRoot(...)` and immediately before
  `initializeDocs()`. The call passes `mainLog` as the logger so
  migration events land in `~/.rox/logs/main.log`.

Call-site reference for closeout traceability:
`apps/electron/src/main/index.ts:426` —
`migrateUserDataIfNeeded({ logger: mainLog })`.

`apps/electron/src/main/__tests__/user-data-migration-startup.test.ts`:
new file (T294-owned integration test).

`.swarm/master-roadmap-log.md`: appended the R.8 ledger line.

## 7. Validation commands run

- `bun test packages/shared/src/config/__tests__/user-data-migration.test.ts`
- `bun test apps/electron/src/main/__tests__/user-data-migration-startup.test.ts`
- `bun run typecheck`
- `bun run lint:shared`
- `bun run lint:electron`
- `bun run validate:rebrand`
- `bun run validate:roadmap`
- `git diff --check`

## 8. Passing test output summary

T293 suite:

```
bun test v1.3.13 (bf2e2cec)
 5 pass
 0 fail
 60 expect() calls
Ran 5 tests across 1 file. [55.00ms]
```

T294 suite:

```
bun test v1.3.13 (bf2e2cec)
 4 pass
 0 fail
 16 expect() calls
Ran 4 tests across 1 file. [179.00ms]
```

## 9. Build output summary

No `bun run electron:build` triggered — the change is a single
function call and a single named-import addition. The downstream
build / packaging contracts are covered by existing R.7 tests
(`r7-docker-ci-build.test.ts`, `mac-liquid-glass-icon-contract.test.ts`).

## 10. Remaining risks

- **Mainlog timing**: `mainLog` is initialized at module import time
  via `import log, { ..., mainLog } from './logger'`. The shim is
  called inside `app.whenReady`, well after that import resolves, so
  the logger is guaranteed to exist. No race.
- **Failure semantics**: the migration call is not wrapped in
  try/catch. A `cpSync` failure would bubble through
  `app.whenReady().then(...)` into Electron's unhandledRejection
  handler and into Sentry. This is acceptable because the shim is
  non-destructive — a partial copy leaves no marker, so the next
  launch retries cleanly.
- **Headless smoke**: the existing `ROX_HEADLESS=1 +
  ROX_SMOKE_USER_DATA_DIR=...` smoke path (lines 194–196 of
  index.ts) overrides Electron's `userData` path but does NOT
  override `homedir()`. The shim therefore still targets the real
  home directory in smoke mode. This is intentional — smoke runs
  should observe whatever migration state the host has. If a
  hermetic smoke run needs an isolated migration, the caller can
  invoke the shim with explicit `legacyRoots` / `newRoot` options.
- **Defense-in-depth duplication**: the legacy `paths.ts`
  auto-migration still runs on first `getConfigDir()`. With the new
  shim wired in early, the legacy block almost always finds
  `~/.rox/` already exists (because the shim either created it or
  declined to). This is harmless — the legacy block guards on
  `!existsSync(newDir)` and silently no-ops. Future cleanup can
  remove the paths.ts block once one minor version has shipped with
  the new shim in place; flagged for a follow-up ticket rather than
  handled here.

## 11. Acceptance criteria matrix

- [x] `apps/electron/src/main/index.ts` imports
      `migrateUserDataIfNeeded` from `@rox-one/shared/config`.
- [x] Migration call runs before every storage seeder inside
      `app.whenReady`.
- [x] Integration test asserts the call ordering.
- [x] T293 unit-test suite and T294 integration-test suite both
      green.
- [x] `.swarm/master-roadmap-log.md` carries the R.8 ledger line.
