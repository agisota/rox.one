# T293 - User-data migration implementation and fixture-FS tests

Status: DONE

## Context

Phase R.8 of the ROX.ONE rebrand sweep ships the
`migrateUserDataIfNeeded()` shim. The design contract lives in T292's
spec
(`docs/superpowers/specs/2026-05-13-user-data-migration-design.md`).

This ticket lands the implementation at
`packages/shared/src/config/user-data-migration.ts` plus a
fixture-filesystem test suite at
`packages/shared/src/config/__tests__/user-data-migration.test.ts`.

## Goal

A pure, dependency-injected migration function that:

- Detects `~/.rox-agent/` first, then `~/.rox/` (per spec priority).
- Copies the legacy tree to `~/.rox/` only when the destination does
  not exist.
- Writes a `.migrated-from-rox` marker after a successful copy.
- Short-circuits on the marker (re-run no-op).
- Warns and refuses to copy when both legacy and `~/.rox/` exist.

## Required UI

None.

## Required Data/API

The shim's only on-disk side effect is `cpSync(legacy, newRoot)` and a
small ASCII marker file. No new schemas.

## Required Automations

None at the package layer. T294 wires the shim into Electron startup.

## Required Subagents

None — the shim is a leaf module.

## TDD Requirements

Write the test suite first. Cover the four cases from the spec plus the
priority-order assertion:

1. No legacy path → `{ migrated: false, reason: 'no-legacy-path' }`.
2. Legacy `~/.rox-agent/` exists, `~/.rox/` does not → copies tree,
   writes marker, returns `{ migrated: true, source, filesCopied: N }`.
3. Both legacy and `~/.rox/` exist → warn, no copy, returns
   `{ migrated: false, reason: 'destination-exists', conflict: true }`.
   Marker NOT written.
4. Marker already exists → idempotent no-op, returns
   `{ migrated: false, reason: 'already-migrated' }`.
5. Priority: when both `~/.rox-agent/` and `~/.rox/` exist (and
   `~/.rox/` does not), the source is `~/.rox-agent/`.

Each test uses `mkdtempSync(join(tmpdir(), '...'))` for isolation and
injects `legacyRoots` + `newRoot` so the real `~/` is never touched.
Logger calls are captured through an injected `MigrationLogger` stub
(not `spyOn(process.stderr)`, since the shim has no direct
`console.*` write).

Confirm the test fails first for "module does not exist" before any
implementation lands.

## Implementation Requirements

- Use `fs.cpSync(src, dst, { recursive: true })` — **never** `rename` or
  `mv`. The legacy tree must remain intact.
- Pass `verbatimSymlinks: true` so the cp preserves symlinks instead of
  dereferencing them (Node 22+; older hosts silently ignore — flagged
  in worklog as residual risk).
- Write the marker file **after** the cp returns success (atomic
  ordering — a crash leaves no marker so the next launch retries).
- Always check the marker **before** stat'ing the legacy roots; this
  keeps the fast path off the disk.
- Logger calls use the injected `MigrationLogger`; no
  `console.warn`/`process.stderr` from the shim.
- Export from the package barrel
  `packages/shared/src/config/index.ts` so the Electron wire-up can
  `import { migrateUserDataIfNeeded } from '@rox-one/shared/config'`.

## Validation Commands

- `bun test packages/shared/src/config/__tests__/user-data-migration.test.ts`
- `bun run typecheck`
- `bun run lint`
- `bun run validate:rebrand`
- `bun run validate:roadmap`
- `git diff --check`

## Acceptance Criteria

- [x] `packages/shared/src/config/user-data-migration.ts` exports
      `migrateUserDataIfNeeded`, `MigrationResult`, `MigrationOptions`.
- [x] Four-case test suite is green on the new module.
- [x] Priority-order assertion is green.
- [x] Module is re-exported from
      `packages/shared/src/config/index.ts`.
- [x] `bun run typecheck` is green.

## Worklog

Update `docs/worklog/T293-user-data-migration-impl.md`.
