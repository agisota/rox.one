# User-Data Migration Shim — Design Spec

Date: 2026-05-13
Author: Phase R.8 (rebrand sweep)
Status: Draft — paired with tickets T292/T293/T294
Phase: R.8 of the ROX.ONE rebrand sweep

## 1. Overview

Existing single-user installs of the legacy product still have configuration
state under `~/.craft-agent/` (older `craft-agent` installs) or `~/.craft/`
(short-lived intermediate name). Phase R.8 adds a one-shot startup migration
shim that **copies** that state to `~/.rox/` once on first launch of the
rebranded app, then writes a marker file so subsequent launches are a fast
no-op.

The shim is `migrateUserDataIfNeeded()`, exported from
`packages/shared/src/config/user-data-migration.ts`. The Electron main
process calls it before any storage read (concretely, before
`ensureConfigDir()` from `@rox-one/shared/config`).

## 2. Goals & Non-Goals

### 2.1 Goals
- Single-user upgrade path: a user with `~/.craft-agent/` and no `~/.rox/`
  sees their workspaces / preferences / themes appear in `~/.rox/` after
  one app launch, with no manual steps.
- Idempotent: re-running the shim never duplicates work and never overwrites
  a destination that has already been migrated.
- Non-destructive: the legacy directory is **copied**, not moved. The user
  can still roll back by reinstalling the legacy build until they choose to
  delete the legacy directory themselves.
- Conflict-safe: if both legacy and new directories exist, the shim warns
  the user via logger and does nothing. No silent merge.
- Testable: fixture filesystems via `tmpdir()` cover all four states. The
  function takes an injectable `legacyRoots` / `newRoot` / `logger` so
  tests never touch the real `~/`.

### 2.2 Non-Goals
- ❌ Schema migration of config-file *content* (handled by the existing
  `migrateLegacyLlmConnectionsConfig` / `migrateLegacyCredentials` chain).
- ❌ Multi-tenant migration (out of scope — that is C.4's lane).
- ❌ Credential keychain migration (handled by `credentialManager`).
- ❌ Symlink farms inside the legacy directory — see §6.
- ❌ Cross-machine migration (network-mounted homedirs, NFS) — same
  copy semantics apply, but no special locking.

## 3. Detection Priority

The shim probes legacy roots in this order:

1. `~/.craft-agent/` (older — was the brand at v0.5.x)
2. `~/.craft/` (intermediate — was the brand at v0.7.x–v0.8.x)

First hit wins. If the user somehow has both, the first one found is the
copy source; the second is left alone (and a warn is logged so they know).

## 4. API

```ts
// packages/shared/src/config/user-data-migration.ts

export type MigrationReason =
  | 'no-legacy-path'        // No legacy root found.
  | 'destination-exists'    // ~/.rox/ already exists alongside legacy.
  | 'already-migrated';     // Marker file present — second-run no-op.

export interface MigrationResult {
  migrated: boolean;
  reason?: MigrationReason;
  source?: string;          // Absolute path of legacy root copied.
  filesCopied?: number;     // Best-effort count (recursive walk).
  conflict?: boolean;       // True when destination-exists case.
}

export interface MigrationLogger {
  info: (msg: string) => void;
  warn: (msg: string) => void;
}

export interface MigrationOptions {
  legacyRoots?: string[];   // Default ['~/.craft-agent', '~/.craft'].
  newRoot?: string;         // Default '~/.rox'.
  logger?: MigrationLogger; // Default no-op (caller wires console/log).
  marker?: string;          // Default '.migrated-from-craft'.
}

export function migrateUserDataIfNeeded(opts?: MigrationOptions): MigrationResult;
```

The shim resolves `~` via `os.homedir()` exactly once per call.

## 5. State Machine

| State | Pre-condition | Action | Return |
|---|---|---|---|
| No legacy | None of the legacyRoots exist | None | `{ migrated: false, reason: 'no-legacy-path' }` |
| Legacy only | Exactly one legacyRoot exists, newRoot does NOT exist | `cpSync(legacy, newRoot, { recursive: true })` then write marker | `{ migrated: true, source: legacy, filesCopied: N }` |
| Both exist | A legacyRoot exists AND newRoot exists AND newRoot lacks marker | Logger.warn, no copy, no marker | `{ migrated: false, reason: 'destination-exists', conflict: true }` |
| Already migrated | newRoot exists AND newRoot/<marker> exists | Short-circuit, no walk | `{ migrated: false, reason: 'already-migrated' }` |

The `already-migrated` branch is checked **first** so re-runs never even
stat the legacy directories.

## 6. Symlink Safety

`fs.cpSync(src, dst, { recursive: true })` follows symlinks by default,
which can produce a copy that explodes on a self-referential link. The
implementation passes `{ recursive: true, verbatimSymlinks: true }` (the
documented Node 22+ option that preserves symlinks instead of dereferencing
them). On older Node hosts the option is silently ignored — that is the
documented Node behavior; the worklog flags this as a residual risk.

## 7. Marker File Contents

The marker file is `<newRoot>/.migrated-from-craft`. Plain ASCII, two
lines:

```
migrated-from: /home/<user>/.craft-agent
timestamp: 2026-05-13T20:42:11.123Z
```

The marker is written **after** the `cpSync` returns success, so a
crash-during-copy leaves no marker and the next launch can retry.

## 8. Logger Contract

The shim never touches `console.*` or `process.stderr` directly. Callers
supply a `MigrationLogger` (or accept the silent default). The Electron
wire-up (T294) passes `mainLog` so the events show up in
`~/.rox/logs/main.log` alongside every other startup event.

Three log events:

1. Info — `[user-data-migration] starting copy from <legacy> → <newRoot>`.
2. Info — `[user-data-migration] copy complete (<N> files), marker written`.
3. Warn — `[user-data-migration] both <legacy> and <newRoot> exist; skipping
   migration. Consolidate manually if you want the legacy data.`

The "already-migrated" branch logs nothing — silent fast path.

## 9. Electron Startup Wire

`migrateUserDataIfNeeded()` is invoked inside the `app.whenReady()`
handler in `apps/electron/src/main/index.ts`, **before** any call into
`@rox-one/shared/config` that performs `ensureConfigDir()` or
`initializeDocs()`. Concretely it lands just before `initializeDocs()` so
the docs seeder sees a `~/.rox/` that already contains migrated state.

The wire passes `mainLog` as the logger. No try/catch — failures bubble up
to Sentry via the normal Electron unhandledException path (the migration
is non-destructive, so a partial copy is acceptable damage).

## 10. Tests

`packages/shared/src/config/__tests__/user-data-migration.test.ts` covers
the four cases from §5 using fixture filesystems built with
`mkdtempSync(join(tmpdir(), '...'))`. Each case asserts:

1. The `MigrationResult` shape (reason, source, filesCopied, conflict).
2. The destination tree's contents (presence/absence of expected files).
3. The marker file (or its absence) and its contents.
4. The logger calls (info/warn count and substring match).

Additional case: the priority order — when both `~/.craft-agent/` and
`~/.craft/` exist (and `~/.rox/` does not), `~/.craft-agent/` is the
source.

The Electron-side integration test asserts the migration is invoked
before `ensureConfigDir()` returns.

## 11. Risks & Open Questions

- **Disk-space pressure**: a large legacy tree doubles disk usage during
  the migration. Acceptable for single-user installs; the worklog flags
  it for the operator.
- **Pre-Node-22 hosts**: `verbatimSymlinks` is ignored, so a symlink
  inside the legacy directory may be dereferenced into a real copy. This
  is a degradation, not a corruption.
- **Windows long paths**: the shim relies on `fs.cpSync`'s Windows
  long-path support. Bun's stdlib polyfills this on Win32; the worklog
  documents the assumption.
- **Marker tampering**: a user who deletes `~/.rox/.migrated-from-craft`
  can re-trigger the conflict branch on next launch (because both roots
  now exist). The shim handles this by emitting the warn message; the
  user is expected to consolidate manually.
