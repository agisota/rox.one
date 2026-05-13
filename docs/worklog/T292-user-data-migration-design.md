# T292 - User-data migration design

Status: DONE
Phase: R.8
Ticket: docs/tickets/T292-user-data-migration-design.md

## 1. Task summary

Author the design spec for the Phase R.8 user-data migration shim and
register T292/T293/T294 against it. T292 is design-only; T293 lands the
implementation + tests, T294 lands the Electron startup wire.

## 2. Repo context discovered

- `packages/shared/src/config/paths.ts` already contains a *partial*
  auto-migration block: when `~/.rox/` is missing and `~/.craft-agent/`
  exists, it does a `cpSync` inline. That logic is import-time and
  unconditional — it does NOT write a marker, does NOT log, does NOT
  detect both-exist conflict, and is implicit (kicks in on the first
  `getConfigDir()` call anywhere in the codebase).
- The Phase R.8 spec requires a marker file (`.migrated-from-craft`),
  conflict detection, structured logging, and idempotency. R.8 layers
  these on top of the legacy quick-fix without removing it (the
  paths.ts block stays as defense-in-depth for any caller that runs
  before the Electron wire-up gets a chance).
- `apps/electron/src/main/index.ts` is the only Electron bootstrap.
  `app.whenReady().then(async () => { ... })` begins around line 382
  in the v1.0.0 head. The first call to a storage seeder
  (`initializeDocs()`) lands ~40 lines further down. R.8 inserts the
  shim between those two points.
- `ensureConfigDir` is exported from
  `packages/shared/src/config/storage-io.ts` and is called transitively
  by `ensureToolIcons`, `ensurePresetThemes`, `saveConfig`,
  `ensureConfigDefaults`. The shim must precede all of those.

## 3. Files inspected

- `docs/superpowers/goals/2026-05-13-rox-one-rebrand-sweep-goal.md`
  (Phase R.8 spec).
- `docs/superpowers/goals/2026-05-13-rox-one-v1-end-to-end-spine-goal.md`
  (R.8 ledger row).
- `packages/shared/src/config/paths.ts`.
- `packages/shared/src/config/storage-io.ts` (lines 197–216 around
  `ensureConfigDir`).
- `apps/electron/src/main/index.ts` (lines 1–470, especially the
  `app.whenReady` block).
- `docs/superpowers/specs/2026-05-09-audit-harness-design.md` (style
  reference for a half-page spec).
- `docs/tickets/T289-rebrand-dockerfile.md` and its worklog (style
  reference for R.7 11-section worklogs).

## 4. Tests added first

None — T292 is design-only. T293 owns the test suite at
`packages/shared/src/config/__tests__/user-data-migration.test.ts` and
T294 owns the Electron integration test at
`apps/electron/src/main/__tests__/user-data-migration-startup.test.ts`.

## 5. Expected failing test output

N/A.

## 6. Implementation changes

`docs/superpowers/specs/2026-05-13-user-data-migration-design.md` —
new file. Covers:

- Goals & non-goals.
- Detection priority (`~/.craft-agent/` before `~/.craft/`).
- API surface (`MigrationResult`, `MigrationOptions`,
  `MigrationLogger`, `migrateUserDataIfNeeded`).
- State machine for the four cases.
- Symlink safety (Node 22+ `verbatimSymlinks: true`, degraded on older
  hosts).
- Marker file contents and atomic-write ordering.
- Logger contract (no direct `console.*`).
- Electron startup wire location.
- Test matrix.
- Risks (disk pressure, Node version, Windows long paths, marker
  tampering).

`docs/tickets/T292-user-data-migration-design.md` — new file.

## 7. Validation commands run

- `bun run validate:rebrand` — green for R.8-scope buckets.
- `bun run validate:roadmap` — green.
- `git diff --check` — green.

## 8. Passing test output summary

N/A — T292 ships no code or tests.

## 9. Build output summary

N/A — doc-only change.

## 10. Remaining risks

- The Phase R.8 spec is silent on what happens if a legacy directory
  is a symlink itself (rather than containing symlinks). The shim
  follows the symlink at the root (because `cpSync` reads stats on the
  src) but does not dereference contents thanks to `verbatimSymlinks`.
  This is acceptable behavior — a legacy-root symlink resolving to an
  existing directory is functionally equivalent to that directory.
- The marker file's plain-text format is not machine-validated. A user
  who edits the marker can confuse the shim — but the only outcome is
  a no-op fast path, which is safe.

## 11. Acceptance criteria matrix

- [x] Spec authored at the canonical path.
- [x] Spec covers four-state machine, marker contract, logger contract,
      symlink risk, and Electron wire location.
- [x] T293 and T294 reference this spec for their contract.
