# T294 - User-data migration Electron startup wire

Status: DONE

## Context

T293 lands the `migrateUserDataIfNeeded()` shim. T294 wires it into
the Electron main process so the migration runs once at app startup,
**before** any `ensureConfigDir()` call (which would otherwise create
an empty `~/.rox/` and trip the conflict branch).

This ticket is also the R.8 closeout — its commit appends the R.8
ledger line to `.swarm/master-roadmap-log.md`.

## Goal

Add a single call to `migrateUserDataIfNeeded({ logger: mainLog })`
inside `app.whenReady().then(...)` in
`apps/electron/src/main/index.ts`, positioned before
`initializeDocs()` and before the seeder functions
(`ensureToolIcons`, `ensurePresetThemes`) that implicitly call
`ensureConfigDir()`.

## Required UI

None.

## Required Data/API

None.

## Required Automations

None — Electron startup is the only call site.

## Required Subagents

None.

## TDD Requirements

Add an integration test at
`apps/electron/src/main/__tests__/user-data-migration-startup.test.ts`
that asserts:

1. `migrateUserDataIfNeeded` is exported from `@rox-one/shared/config`
   (proves the import the wire-up depends on actually exists).
2. The Electron main file imports it and invokes it inside
   `app.whenReady`.
3. The invocation is positioned **before** the first call to
   `initializeDocs()` / `ensureToolIcons()` / `ensurePresetThemes()`
   (string-order assertion on the file text, like the existing
   electron-builder regression test).

The test must fail before the wire lands and pass after.

## Implementation Requirements

- Single new import line in `apps/electron/src/main/index.ts`:
  `import { migrateUserDataIfNeeded } from '@rox-one/shared/config'`.
- Single new call inside `app.whenReady().then(async () => { ... })`:
  `migrateUserDataIfNeeded({ logger: mainLog })`.
- The call MUST land before any of: `initializeDocs()`,
  `initializeReleaseNotes()`, `ensureToolIcons(DEFAULT_LOCAL_SCOPE)`,
  `ensurePresetThemes(DEFAULT_LOCAL_SCOPE)`.
- No try/catch — failures bubble through Sentry (the shim is
  non-destructive, partial copies are recoverable).

## Validation Commands

- `bun test apps/electron/src/main/__tests__/user-data-migration-startup.test.ts`
- `bun test packages/shared/src/config/__tests__/user-data-migration.test.ts`
- `bun run typecheck`
- `bun run lint`
- `bun run validate:rebrand`
- `bun run validate:roadmap`
- `git diff --check`

## Acceptance Criteria

- [x] `apps/electron/src/main/index.ts` imports
      `migrateUserDataIfNeeded` from `@rox-one/shared/config`.
- [x] The migration runs before any storage-seeder call inside
      `app.whenReady`.
- [x] Integration test asserts the call ordering.
- [x] `.swarm/master-roadmap-log.md` carries the R.8 ledger line.

## Worklog

Update `docs/worklog/T294-user-data-migration-electron-startup-wire.md`.
