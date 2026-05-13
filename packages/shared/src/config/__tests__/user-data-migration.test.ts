import { describe, expect, it } from 'bun:test'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

import {
  migrateUserDataIfNeeded,
  type MigrationLogger,
  type MigrationOptions,
} from '../user-data-migration.ts'

/**
 * Phase R.8 — user-data migration shim test matrix.
 *
 * Covers the four stopping-condition cases from
 * `docs/superpowers/specs/2026-05-13-user-data-migration-design.md`:
 *
 *   1. No legacy path → no-op.
 *   2. Legacy only → copy + marker.
 *   3. Both exist → warn, no-op, no marker.
 *   4. Marker present → idempotent no-op.
 *
 * Plus the priority-order assertion: `~/.rox-agent/` wins over
 * `~/.rox/` when both legacy roots are present.
 *
 * Every test uses fixture filesystems via `mkdtempSync(tmpdir())` and
 * injects `legacyRoots` + `newRoot`. The real `~/.rox-agent/` /
 * `~/.rox/` / `~/.rox/` are never touched.
 */

interface CapturedLogs {
  info: string[]
  warn: string[]
}

function makeLogger(): { logger: MigrationLogger; logs: CapturedLogs } {
  const logs: CapturedLogs = { info: [], warn: [] }
  const logger: MigrationLogger = {
    info: (msg: string) => logs.info.push(msg),
    warn: (msg: string) => logs.warn.push(msg),
  }
  return { logger, logs }
}

function makeFixtureRoot(prefix: string): string {
  return mkdtempSync(join(tmpdir(), prefix))
}

/** Seed a legacy tree with a handful of nested files we can assert against. */
function seedLegacyTree(root: string): { fileCount: number } {
  mkdirSync(join(root, 'workspaces', 'ws-alpha'), { recursive: true })
  mkdirSync(join(root, 'logs'), { recursive: true })
  mkdirSync(join(root, 'themes'), { recursive: true })
  writeFileSync(join(root, 'config.json'), '{"version":1}\n', 'utf8')
  writeFileSync(join(root, 'preferences.json'), '{"theme":"dark"}\n', 'utf8')
  writeFileSync(
    join(root, 'workspaces', 'ws-alpha', 'config.json'),
    '{"name":"alpha"}\n',
    'utf8',
  )
  writeFileSync(join(root, 'logs', 'main.log'), 'startup ok\n', 'utf8')
  writeFileSync(join(root, 'themes', 'custom.json'), '{}\n', 'utf8')
  return { fileCount: 5 }
}

function cleanup(...paths: string[]) {
  for (const p of paths) {
    try {
      rmSync(p, { recursive: true, force: true })
    } catch {
      /* ignore */
    }
  }
}

function makeOpts(
  legacyRoots: string[],
  newRoot: string,
  logger: MigrationLogger,
): MigrationOptions {
  return { legacyRoots, newRoot, logger }
}

describe('migrateUserDataIfNeeded', () => {
  it('Case 1: returns no-legacy-path when no legacy directory exists', () => {
    const sandbox = makeFixtureRoot('r8-case1-')
    const newRoot = join(sandbox, '.rox')
    const legacyA = join(sandbox, '.rox-agent')
    const legacyB = join(sandbox, '.rox')
    const { logger, logs } = makeLogger()

    try {
      const result = migrateUserDataIfNeeded(
        makeOpts([legacyA, legacyB], newRoot, logger),
      )

      expect(result.migrated).toBe(false)
      expect(result.reason).toBe('no-legacy-path')
      expect(result.source).toBeUndefined()
      expect(result.filesCopied).toBeUndefined()
      expect(result.conflict).toBeUndefined()

      // No directory should have been auto-created.
      expect(existsSync(newRoot)).toBe(false)
      expect(existsSync(legacyA)).toBe(false)
      expect(existsSync(legacyB)).toBe(false)

      // Quiet path — no info, no warn.
      expect(logs.info).toEqual([])
      expect(logs.warn).toEqual([])
    } finally {
      cleanup(sandbox)
    }
  })

  it('Case 2: copies legacy ~/.rox-agent/ tree to ~/.rox/ and writes marker', () => {
    const sandbox = makeFixtureRoot('r8-case2-')
    const legacyA = join(sandbox, '.rox-agent')
    const legacyB = join(sandbox, '.rox')
    const newRoot = join(sandbox, '.rox')
    const { logger, logs } = makeLogger()

    const seed = seedLegacyTree(legacyA)

    try {
      const before = Date.now()
      const result = migrateUserDataIfNeeded(
        makeOpts([legacyA, legacyB], newRoot, logger),
      )
      const after = Date.now()

      expect(result.migrated).toBe(true)
      expect(result.reason).toBeUndefined()
      expect(result.source).toBe(legacyA)
      expect(result.filesCopied).toBe(seed.fileCount)
      expect(result.conflict).toBeUndefined()

      // Destination tree must mirror the legacy tree.
      expect(existsSync(join(newRoot, 'config.json'))).toBe(true)
      expect(existsSync(join(newRoot, 'preferences.json'))).toBe(true)
      expect(
        existsSync(join(newRoot, 'workspaces', 'ws-alpha', 'config.json')),
      ).toBe(true)
      expect(existsSync(join(newRoot, 'logs', 'main.log'))).toBe(true)
      expect(existsSync(join(newRoot, 'themes', 'custom.json'))).toBe(true)

      // File contents copied verbatim.
      expect(readFileSync(join(newRoot, 'config.json'), 'utf8')).toBe(
        '{"version":1}\n',
      )

      // Legacy tree must remain intact (copy, not move).
      expect(existsSync(join(legacyA, 'config.json'))).toBe(true)
      expect(readFileSync(join(legacyA, 'config.json'), 'utf8')).toBe(
        '{"version":1}\n',
      )

      // Marker written, with correct contents and a valid ISO timestamp.
      const markerPath = join(newRoot, '.migrated-from-rox')
      expect(existsSync(markerPath)).toBe(true)
      const markerBody = readFileSync(markerPath, 'utf8')
      expect(markerBody).toContain(`migrated-from: ${legacyA}`)
      const tsMatch = markerBody.match(/timestamp:\s*(\S+)/)
      expect(tsMatch).not.toBeNull()
      const ts = Date.parse(tsMatch![1]!)
      expect(Number.isFinite(ts)).toBe(true)
      expect(ts).toBeGreaterThanOrEqual(before - 1)
      expect(ts).toBeLessThanOrEqual(after + 1)

      // Info log fired (start + complete); no warn.
      expect(logs.info.length).toBeGreaterThanOrEqual(1)
      expect(logs.info.join(' ')).toContain('user-data-migration')
      expect(logs.info.join(' ')).toContain(legacyA)
      expect(logs.warn).toEqual([])
    } finally {
      cleanup(sandbox)
    }
  })

  it('Case 3: warns and does nothing when both legacy and new root exist (no marker)', () => {
    const sandbox = makeFixtureRoot('r8-case3-')
    const legacyA = join(sandbox, '.rox-agent')
    const legacyB = join(sandbox, '.rox')
    const newRoot = join(sandbox, '.rox')
    const { logger, logs } = makeLogger()

    seedLegacyTree(legacyA)
    // newRoot exists with content the user already curated.
    mkdirSync(newRoot, { recursive: true })
    writeFileSync(join(newRoot, 'config.json'), '{"version":2}\n', 'utf8')

    try {
      const result = migrateUserDataIfNeeded(
        makeOpts([legacyA, legacyB], newRoot, logger),
      )

      expect(result.migrated).toBe(false)
      expect(result.reason).toBe('destination-exists')
      expect(result.conflict).toBe(true)
      expect(result.source).toBeUndefined()
      expect(result.filesCopied).toBeUndefined()

      // newRoot kept the user-curated content verbatim — no merge.
      expect(readFileSync(join(newRoot, 'config.json'), 'utf8')).toBe(
        '{"version":2}\n',
      )
      // No marker written.
      expect(existsSync(join(newRoot, '.migrated-from-rox'))).toBe(false)
      // Legacy tree untouched.
      expect(existsSync(join(legacyA, 'config.json'))).toBe(true)

      // Warn fired exactly once.
      expect(logs.warn.length).toBeGreaterThanOrEqual(1)
      expect(logs.warn.join(' ')).toContain('user-data-migration')
      expect(logs.warn.join(' ')).toContain(legacyA)
      expect(logs.warn.join(' ')).toContain(newRoot)
    } finally {
      cleanup(sandbox)
    }
  })

  it('Case 4: re-run after marker exists is an idempotent no-op', () => {
    const sandbox = makeFixtureRoot('r8-case4-')
    const legacyA = join(sandbox, '.rox-agent')
    const legacyB = join(sandbox, '.rox')
    const newRoot = join(sandbox, '.rox')
    const { logger, logs } = makeLogger()

    seedLegacyTree(legacyA)
    mkdirSync(newRoot, { recursive: true })
    writeFileSync(
      join(newRoot, '.migrated-from-rox'),
      `migrated-from: ${legacyA}\ntimestamp: 2026-05-13T00:00:00.000Z\n`,
      'utf8',
    )
    writeFileSync(join(newRoot, 'sentinel.txt'), 'do-not-overwrite\n', 'utf8')

    try {
      const result = migrateUserDataIfNeeded(
        makeOpts([legacyA, legacyB], newRoot, logger),
      )

      expect(result.migrated).toBe(false)
      expect(result.reason).toBe('already-migrated')
      expect(result.source).toBeUndefined()
      expect(result.filesCopied).toBeUndefined()
      expect(result.conflict).toBeUndefined()

      // Untouched: the sentinel still has its original contents and the
      // marker was not overwritten.
      expect(readFileSync(join(newRoot, 'sentinel.txt'), 'utf8')).toBe(
        'do-not-overwrite\n',
      )
      expect(
        readFileSync(join(newRoot, '.migrated-from-rox'), 'utf8'),
      ).toContain('2026-05-13T00:00:00.000Z')

      // Legacy tree files were NOT copied because already-migrated is
      // checked first — the fast path never walks legacy.
      expect(existsSync(join(newRoot, 'preferences.json'))).toBe(false)
      expect(existsSync(join(newRoot, 'workspaces'))).toBe(false)

      // Quiet fast path: no info, no warn.
      expect(logs.info).toEqual([])
      expect(logs.warn).toEqual([])
    } finally {
      cleanup(sandbox)
    }
  })

  it('Priority: ~/.rox-agent/ is preferred over ~/.rox/ when both exist', () => {
    const sandbox = makeFixtureRoot('r8-priority-')
    const legacyA = join(sandbox, '.rox-agent')
    const legacyB = join(sandbox, '.rox')
    const newRoot = join(sandbox, '.rox')
    const { logger } = makeLogger()

    // Both legacies seeded with DIFFERENT contents so we can prove which
    // one was the copy source.
    mkdirSync(legacyA, { recursive: true })
    writeFileSync(join(legacyA, 'config.json'), '{"from":"rox-agent"}\n', 'utf8')
    mkdirSync(legacyB, { recursive: true })
    writeFileSync(join(legacyB, 'config.json'), '{"from":"rox"}\n', 'utf8')

    try {
      const result = migrateUserDataIfNeeded(
        makeOpts([legacyA, legacyB], newRoot, logger),
      )

      expect(result.migrated).toBe(true)
      expect(result.source).toBe(legacyA)
      expect(readFileSync(join(newRoot, 'config.json'), 'utf8')).toBe(
        '{"from":"rox-agent"}\n',
      )
      // The lower-priority legacy was not touched and not copied.
      expect(readFileSync(join(legacyB, 'config.json'), 'utf8')).toBe(
        '{"from":"rox"}\n',
      )
    } finally {
      cleanup(sandbox)
    }
  })
})
