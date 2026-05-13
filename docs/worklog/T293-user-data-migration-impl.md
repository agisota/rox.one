# T293 - User-data migration implementation and fixture-FS tests

Status: DONE
Phase: R.8
Ticket: docs/tickets/T293-user-data-migration-impl.md
Spec: docs/superpowers/specs/2026-05-13-user-data-migration-design.md

## 1. Task summary

Ship the `migrateUserDataIfNeeded()` shim at
`packages/shared/src/config/user-data-migration.ts` plus a
fixture-filesystem test matrix at
`packages/shared/src/config/__tests__/user-data-migration.test.ts`.
Re-export the public surface from `packages/shared/src/config/index.ts`
so the Electron wire-up (T294) can `import { migrateUserDataIfNeeded }
from '@rox-one/shared/config'`.

## 2. Repo context discovered

- The existing partial auto-migration in `packages/shared/src/config/paths.ts`
  (lines 19–31) does an import-time `cpSync(legacyDir, newDir, { recursive: true })`
  but lacks marker, conflict detection, and logging. R.8 layers a
  proper shim on top; the paths.ts block stays as defense-in-depth.
- `bun:test` is the test runner. Existing fixture-FS test patterns
  (`packages/shared/src/config/__tests__/storage-migrations.test.ts`,
  `storage-startup-migration.test.ts`) use `mkdtempSync(tmpdir())` for
  isolation. R.8 follows the same shape.
- Stderr capture patterns (`spyOn(process.stderr, 'write')` and
  `spyOn(console, 'warn')`) are documented in
  `packages/shared/src/utils/__tests__/env-compat.test.ts`. R.8 does
  not need them — the shim has no direct `console.*` write; logger is
  dependency-injected.
- `fs.cpSync` is available in Bun 1.x. `verbatimSymlinks: true` is a
  Node 22+ option that Bun honors on supported platforms; on older
  hosts the option is silently ignored.

## 3. Files inspected

- `packages/shared/src/config/paths.ts` (the existing partial migration).
- `packages/shared/src/config/__tests__/storage-migrations.test.ts`
  (fixture-FS pattern reference).
- `packages/shared/src/config/__tests__/storage-startup-migration.test.ts`
  (Bun.spawnSync pattern reference — not used here, but informative).
- `packages/shared/src/utils/env-compat.ts` and its test file (logger /
  warning-once pattern; the shim follows the same DI shape).
- `packages/shared/src/config/storage-io.ts` (`ensureConfigDir` call
  site reference).
- `packages/shared/src/config/index.ts` (barrel exports).

## 4. Tests added first

`packages/shared/src/config/__tests__/user-data-migration.test.ts`
covers five scenarios against fixture filesystems built via
`mkdtempSync(join(tmpdir(), 'r8-...-'))`:

1. **Case 1: no legacy path** — Asserts
   `{ migrated: false, reason: 'no-legacy-path' }` plus the destination
   was not auto-created, plus logger received zero info/warn calls.

2. **Case 2: legacy only** — Seeds `~/.craft-agent/` fixture with five
   files (config.json, preferences.json, nested workspace config, log,
   theme). Asserts `{ migrated: true, source, filesCopied: 5 }`, that
   the destination mirrors the source byte-for-byte, that the legacy
   tree is left intact (copy not move), that the `.migrated-from-craft`
   marker exists with valid ISO-8601 timestamp inside a tight time
   window, and that the info logger was called at least once with the
   source path in the message.

3. **Case 3: both exist** — Seeds legacy and pre-populates the
   destination with curated content. Asserts
   `{ migrated: false, reason: 'destination-exists', conflict: true }`,
   that the destination content is preserved untouched (no merge), that
   no marker is written, that the legacy tree is intact, and that the
   warn logger fired with both paths in the message.

4. **Case 4: already migrated** — Pre-writes the marker and a sentinel
   file in the destination. Asserts
   `{ migrated: false, reason: 'already-migrated' }`, that the
   destination is untouched (sentinel preserved, marker timestamp
   preserved), that the legacy tree is never walked (no copied files
   in destination), and that both info and warn loggers received zero
   calls — the marker is the silent fast path.

5. **Priority order** — Seeds both `~/.craft-agent/` and `~/.craft/`
   with DIFFERENT contents. Asserts the copy source is
   `~/.craft-agent/` (per spec §3) and that `~/.craft/` is left
   untouched.

## 5. Expected failing test output

Initial `bun test` run on the test file alone before the implementation
landed:

```
# Unhandled error between tests
-------------------------------
error: Cannot find module '../user-data-migration.ts' from '/tmp/rox-r8/packages/shared/src/config/__tests__/user-data-migration.test.ts'
-------------------------------

 0 pass
 1 fail
 1 error
Ran 1 test across 1 file. [44.00ms]
```

That is the correct failure mode — module does not exist, so the
import line at the top of the test fails immediately.

## 6. Implementation changes

`packages/shared/src/config/user-data-migration.ts` — new file. Exports:

- Types: `MigrationReason`, `MigrationResult`, `MigrationLogger`,
  `MigrationOptions`.
- Function: `migrateUserDataIfNeeded(opts?: MigrationOptions): MigrationResult`.

Behavior:

1. Marker fast path is checked **first** — `existsSync(markerPath)`
   short-circuits to `{ migrated: false, reason: 'already-migrated' }`.
   This keeps re-runs off the disk completely (no `stat` of legacy
   roots).
2. Legacy root detection: iterates `legacyRoots` (default
   `[~/.craft-agent, ~/.craft]`) and picks the first one that exists.
   Missing → `{ migrated: false, reason: 'no-legacy-path' }`.
3. Conflict check: if both legacy and `newRoot` exist (without a
   marker), logger.warn fires and the function returns
   `{ migrated: false, reason: 'destination-exists', conflict: true }`.
   No copy, no marker — preserves a deliberate re-attempt path.
4. Happy path: `cpSync(source, newRoot, { recursive: true,
   verbatimSymlinks: true })` then file count walk then marker write.
   Marker contents: `migrated-from: <source>\ntimestamp: <ISO>\n`.

`packages/shared/src/config/index.ts` — added re-exports for the public
surface (`migrateUserDataIfNeeded` + four types) just before the
existing `ConfigWatcher` re-export block.

## 7. Validation commands run

- `bun test packages/shared/src/config/__tests__/user-data-migration.test.ts`
- `bun run typecheck`
- `bun run lint:shared`
- `bun run validate:rebrand`
- `bun run validate:roadmap`
- `git diff --check`

## 8. Passing test output summary

`bun test packages/shared/src/config/__tests__/user-data-migration.test.ts`:

```
bun test v1.3.13 (bf2e2cec)

 5 pass
 0 fail
 60 expect() calls
Ran 5 tests across 1 file. [55.00ms]
```

All five cases (4 stopping-condition cases + priority order) green.

## 9. Build output summary

No `bun run build` was triggered for the package-level slice — the
shim is a leaf module and the Electron build is covered by T294's
wire-up.

## 10. Remaining risks

- **Pre-Node-22 hosts**: `verbatimSymlinks: true` is silently ignored
  on older runtimes. A symlink inside the legacy tree may be
  dereferenced into a real copy. This is a one-time degradation
  (legacy installs are unlikely to have meaningful symlinks inside
  `~/.craft-agent/`); flagged here for completeness.
- **Disk-space pressure**: a large legacy tree doubles disk usage
  during the migration. Single-user installs typically have a few MB
  of state; no special handling required.
- **Windows long paths**: relies on Bun's `cpSync` long-path support.
  Not tested here because the fixture filesystem lives under
  `os.tmpdir()` which is well under 260 chars on Win32.
- **Concurrent invocations**: nothing prevents two processes from
  racing the shim. In practice the only call site is Electron main
  process startup, which is single-process; the worklog flags this as
  an out-of-scope risk rather than a real exposure.
- **File-count is best-effort**: the recursive walk swallows errors
  silently and reports 0 for those subtrees. The number is advisory
  (logged for operator signal) and is not contractual — tests assert
  the seeded count exactly (5), so any regression in walk behavior
  will fail Case 2.

## 11. Acceptance criteria matrix

- [x] `packages/shared/src/config/user-data-migration.ts` exports the
      shim and its four types.
- [x] Four-case test suite is green.
- [x] Priority-order assertion is green.
- [x] Module is re-exported from `packages/shared/src/config/index.ts`.
- [x] `bun run typecheck` is green.
- [x] `bun run validate:rebrand` is green for the R.8 bucket.
