import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'fs'
import { join } from 'path'

/**
 * Phase R.8 — Electron startup wire integration test (T294).
 *
 * Asserts:
 *   1. `migrateUserDataIfNeeded` is exported from `@rox-one/shared/config`
 *      (proves the import path the wire-up depends on actually exists).
 *   2. The Electron main process imports it.
 *   3. The migration call lands BEFORE any storage seeder
 *      (`initializeDocs`, `ensureToolIcons`, `ensurePresetThemes`) so
 *      `ensureConfigDir()` never executes against an empty ~/.rox/ that
 *      would trip the conflict branch.
 *
 * The ordering assertion is byte-position on the main-process index file,
 * the same regression-shape used by `scripts/__tests__/r7-docker-ci-build.test.ts`
 * for the electron-builder.yml contract.
 */

const REPO_ROOT = join(import.meta.dir, '..', '..', '..', '..', '..')
const MAIN_INDEX = join(REPO_ROOT, 'apps', 'electron', 'src', 'main', 'index.ts')

function readMain(): string {
  return readFileSync(MAIN_INDEX, 'utf8')
}

function indexOfCall(text: string, fromIndex: number): number {
  return text.indexOf('migrateUserDataIfNeeded(', fromIndex)
}

describe('Phase R.8 — user-data migration is wired into Electron startup', () => {
  it('@rox-one/shared/config re-exports migrateUserDataIfNeeded', async () => {
    const mod = await import('@rox-one/shared/config')
    expect(typeof (mod as { migrateUserDataIfNeeded?: unknown }).migrateUserDataIfNeeded).toBe(
      'function',
    )
  })

  it('apps/electron/src/main/index.ts imports migrateUserDataIfNeeded', () => {
    const text = readMain()
    // Either pulled in via the existing shared/config import line, or
    // re-imported on its own line — both are valid wire-up shapes.
    expect(text).toMatch(
      /import\s*\{[^}]*\bmigrateUserDataIfNeeded\b[^}]*\}\s*from\s*['"]@rox-one\/shared\/config['"]/,
    )
  })

  it('migrateUserDataIfNeeded runs before any storage seeder inside app.whenReady', () => {
    const text = readMain()
    const ready = text.indexOf('app.whenReady().then(')
    expect(ready).toBeGreaterThan(-1)

    // Locate the migration call site itself (must exist after app.whenReady).
    const callPos = indexOfCall(text, ready)
    expect(callPos).toBeGreaterThan(-1)
    expect(callPos).toBeGreaterThan(ready)

    // It must land BEFORE every storage seeder that depends on
    // ensureConfigDir() materializing ~/.rox/.
    const SEEDERS = [
      'initializeDocs()',
      'initializeReleaseNotes()',
      'ensureDefaultPermissions()',
      'ensureToolIcons(DEFAULT_LOCAL_SCOPE)',
      'ensurePresetThemes(DEFAULT_LOCAL_SCOPE)',
    ]
    for (const seeder of SEEDERS) {
      const seederPos = text.indexOf(seeder, ready)
      expect(seederPos).toBeGreaterThan(-1)
      // The migration call must be strictly before this seeder.
      expect(callPos).toBeLessThan(seederPos)
    }
  })

  it('migrateUserDataIfNeeded is invoked exactly once', () => {
    const text = readMain()
    const matches = text.match(/\bmigrateUserDataIfNeeded\s*\(/g) ?? []
    expect(matches.length).toBe(1)
  })
})
