/** Tests for `enforceRetention` (M.14 T249). FS + clock are injected. */
import { describe, expect, it } from 'bun:test'
import { join } from 'node:path'

import {
  DEFAULT_MAX_AGE_MS,
  DEFAULT_MAX_FILES,
  enforceRetention,
  isRotatedAuditFile,
  type RetentionFsDeps,
} from '../audit-retention.ts'

const DAY_MS = 24 * 60 * 60 * 1000
const NOW = new Date('2026-05-14T12:00:00.000Z')
const NOW_MS = NOW.getTime()

function basename(path: string): string {
  const i = path.lastIndexOf('/')
  return i === -1 ? path : path.slice(i + 1)
}

function buildFs(files: Record<string, number>): {
  fs: Required<RetentionFsDeps>
  deletions: string[]
} {
  const deletions: string[] = []
  const live = { ...files }
  return {
    deletions,
    fs: {
      readdir: () => Object.keys(live),
      stat: (path) => {
        const name = basename(path)
        if (!(name in live)) throw new Error(`ENOENT: ${path}`)
        return { mtimeMs: live[name] as number }
      },
      unlink: (path) => {
        const name = basename(path)
        if (!(name in live)) throw new Error(`ENOENT: ${path}`)
        delete live[name]
        deletions.push(path)
      },
    },
  }
}

function run(opts: {
  files: Record<string, number>
  maxAgeMs?: number
  maxFiles?: number
  dir?: string
  clock?: () => Date
}) {
  const { fs, deletions } = buildFs(opts.files)
  const result = enforceRetention({
    dir: opts.dir ?? '/d',
    maxAgeMs: opts.maxAgeMs ?? 90 * DAY_MS,
    maxFiles: opts.maxFiles ?? 60,
    clock: opts.clock ?? (() => NOW),
    fs,
  })
  return { result, deletions }
}

describe('enforceRetention', () => {
  it('returns empty arrays when the directory is empty', () => {
    const { result } = run({ files: {} })
    expect(result.deleted).toEqual([])
    expect(result.kept).toEqual([])
  })

  it('deletes a rotated file older than maxAgeMs', () => {
    const files = {
      'audit-2026-01-01.log': NOW_MS - 120 * DAY_MS,
      'audit-2026-05-12.log': NOW_MS - 2 * DAY_MS,
    }
    const { result, deletions } = run({ files })
    expect(result.deleted).toEqual(['/d/audit-2026-01-01.log'])
    expect(result.kept).toEqual(['/d/audit-2026-05-12.log'])
    expect(deletions).toEqual(['/d/audit-2026-01-01.log'])
  })

  it('keeps a rotated file exactly at the age cutoff', () => {
    const { result } = run({ files: { 'audit-2026-02-13.log': NOW_MS - 90 * DAY_MS } })
    expect(result.deleted).toHaveLength(0)
    expect(result.kept).toEqual(['/d/audit-2026-02-13.log'])
  })

  it('enforces the count cap by deleting the oldest survivors', () => {
    const live: Record<string, number> = {}
    for (let i = 0; i < 5; i++) live[`audit-2026-05-0${i + 1}.log`] = NOW_MS - (5 - i) * DAY_MS
    const { result, deletions } = run({ files: live, maxFiles: 3 })
    expect(result.deleted).toEqual(['/d/audit-2026-05-01.log', '/d/audit-2026-05-02.log'])
    expect(result.kept).toHaveLength(3)
    expect(result.kept[0]).toBe('/d/audit-2026-05-03.log')
    expect(result.kept[2]).toBe('/d/audit-2026-05-05.log')
    expect(deletions).toHaveLength(2)
  })

  it('combines age and count cutoffs: age first, then count', () => {
    const { result } = run({
      files: {
        'audit-2025-12-01.log': NOW_MS - 200 * DAY_MS,
        'audit-2026-01-01.log': NOW_MS - 130 * DAY_MS,
        'audit-2026-04-01.log': NOW_MS - 43 * DAY_MS,
        'audit-2026-04-15.log': NOW_MS - 29 * DAY_MS,
        'audit-2026-05-10.log': NOW_MS - 4 * DAY_MS,
      },
      maxFiles: 2,
    })
    expect(result.deleted).toHaveLength(3)
    expect(result.deleted[0]).toBe('/d/audit-2025-12-01.log')
    expect(result.deleted[1]).toBe('/d/audit-2026-01-01.log')
    expect(result.deleted[2]).toBe('/d/audit-2026-04-01.log')
    expect(result.kept).toEqual(['/d/audit-2026-04-15.log', '/d/audit-2026-05-10.log'])
  })

  it('never deletes the active audit.log even when it is old', () => {
    const files = {
      'audit.log': NOW_MS - 200 * DAY_MS,
      'audit-2026-01-01.log': NOW_MS - 120 * DAY_MS,
    }
    const { result, deletions } = run({ files })
    expect(result.deleted).toEqual(['/d/audit-2026-01-01.log'])
    expect(result.kept).toEqual([])
    expect(deletions).not.toContain('/d/audit.log')
  })

  it('ignores arbitrary non-audit files in the directory', () => {
    const files = {
      'audit-2026-05-01.log': NOW_MS - 5 * DAY_MS,
      'README.md': NOW_MS - 500 * DAY_MS,
      'random.txt': NOW_MS - 500 * DAY_MS,
      'audit-2026-5-1.log': NOW_MS - 500 * DAY_MS,
    }
    const { result } = run({ files })
    expect(result.deleted).toHaveLength(0)
    expect(result.kept).toEqual(['/d/audit-2026-05-01.log'])
  })

  it('recognises numeric-suffix collision filenames', () => {
    const files = {
      'audit-2026-05-01.log': NOW_MS - 5 * DAY_MS,
      'audit-2026-05-01-1.log': NOW_MS - 5 * DAY_MS,
      'audit-2026-05-01-2.log': NOW_MS - 5 * DAY_MS,
    }
    const { result } = run({ files, maxFiles: 2 })
    expect(result.deleted).toHaveLength(1)
    expect(result.kept).toHaveLength(2)
  })

  it('returns paths in oldest-first order', () => {
    const files = {
      'audit-2026-05-10.log': NOW_MS - 4 * DAY_MS,
      'audit-2026-05-01.log': NOW_MS - 13 * DAY_MS,
      'audit-2026-05-05.log': NOW_MS - 9 * DAY_MS,
    }
    const { result } = run({ files, maxFiles: 1 })
    expect(result.deleted).toEqual(['/d/audit-2026-05-01.log', '/d/audit-2026-05-05.log'])
    expect(result.kept).toEqual(['/d/audit-2026-05-10.log'])
  })

  it('is a pure planner when fs.unlink is omitted (no side effects)', () => {
    const live: Record<string, number> = {
      'audit-2026-01-01.log': NOW_MS - 120 * DAY_MS,
      'audit-2026-05-12.log': NOW_MS - 2 * DAY_MS,
    }
    const result = enforceRetention({
      dir: '/d',
      maxAgeMs: 90 * DAY_MS,
      maxFiles: 60,
      clock: () => NOW,
      fs: {
        readdir: () => Object.keys(live),
        stat: (p) => ({ mtimeMs: live[basename(p)] as number }),
      },
    })
    expect(result.deleted).toEqual(['/d/audit-2026-01-01.log'])
    expect(Object.keys(live)).toHaveLength(2)
  })

  it('returns empty when readdir throws (directory absent)', () => {
    const result = enforceRetention({
      dir: '/no',
      maxAgeMs: 90 * DAY_MS,
      maxFiles: 60,
      clock: () => NOW,
      fs: { readdir: () => { throw new Error('ENOENT') } },
    })
    expect(result.deleted).toEqual([])
    expect(result.kept).toEqual([])
  })

  it('skips files whose stat() fails (concurrent unlink race)', () => {
    const live: Record<string, number> = {
      'audit-2026-05-01.log': NOW_MS - 5 * DAY_MS,
      'audit-2026-05-02.log': NOW_MS - 4 * DAY_MS,
    }
    const result = enforceRetention({
      dir: '/d',
      maxAgeMs: 90 * DAY_MS,
      maxFiles: 60,
      clock: () => NOW,
      fs: {
        readdir: () => Object.keys(live),
        stat: (p) => {
          if (p.endsWith('audit-2026-05-01.log')) throw new Error('ENOENT')
          return { mtimeMs: live[basename(p)] as number }
        },
      },
    })
    expect(result.deleted).toEqual([])
    expect(result.kept).toEqual(['/d/audit-2026-05-02.log'])
  })

  it('swallows unlink errors and keeps sweeping the remaining files', () => {
    const { fs } = buildFs({
      'audit-2026-01-01.log': NOW_MS - 200 * DAY_MS,
      'audit-2026-01-02.log': NOW_MS - 199 * DAY_MS,
    })
    let calls = 0
    const result = enforceRetention({
      dir: '/d',
      maxAgeMs: 90 * DAY_MS,
      maxFiles: 60,
      clock: () => NOW,
      fs: {
        readdir: fs.readdir,
        stat: fs.stat,
        unlink: (p) => { calls += 1; if (calls === 1) throw new Error('EPERM'); fs.unlink(p) },
      },
    })
    expect(result.deleted).toHaveLength(2)
    expect(calls).toBe(2)
  })

  it('uses join() to produce absolute paths under the supplied dir', () => {
    const { result } = run({
      files: { 'audit-2026-05-01.log': NOW_MS - 5 * DAY_MS },
      dir: '/var/log/rox',
    })
    expect(result.kept).toEqual([join('/var/log/rox', 'audit-2026-05-01.log')])
  })

  it('honours maxFiles=0 by deleting every rotated file', () => {
    const files = {
      'audit-2026-05-01.log': NOW_MS - 5 * DAY_MS,
      'audit-2026-05-02.log': NOW_MS - 4 * DAY_MS,
    }
    const { result, deletions } = run({ files, maxFiles: 0 })
    expect(result.deleted).toHaveLength(2)
    expect(result.kept).toHaveLength(0)
    expect(deletions).toHaveLength(2)
  })

  it('honours maxAgeMs=0 by deleting every file with mtime in the past', () => {
    const files = {
      'audit-2026-05-01.log': NOW_MS - DAY_MS,
      'audit-2026-05-02.log': NOW_MS - DAY_MS,
    }
    const { result } = run({ files, maxAgeMs: 0 })
    expect(result.deleted).toHaveLength(2)
    expect(result.kept).toHaveLength(0)
  })

  it('exports default constants (90 days, 60 files)', () => {
    expect(DEFAULT_MAX_AGE_MS).toBe(90 * DAY_MS)
    expect(DEFAULT_MAX_FILES).toBe(60)
  })

  it('isRotatedAuditFile recognises the expected shapes only', () => {
    expect(isRotatedAuditFile('audit-2026-05-13.log')).toBe(true)
    expect(isRotatedAuditFile('audit-2026-05-13-1.log')).toBe(true)
    expect(isRotatedAuditFile('audit-2026-05-13-99.log')).toBe(true)
    expect(isRotatedAuditFile('audit.log')).toBe(false)
    expect(isRotatedAuditFile('audit-2026.log')).toBe(false)
    expect(isRotatedAuditFile('audit-2026-5-13.log')).toBe(false)
    expect(isRotatedAuditFile('foo-2026-05-13.log')).toBe(false)
    expect(isRotatedAuditFile('audit-2026-05-13.log.gz')).toBe(false)
  })

  it('uses the injected clock and does not call Date.now() implicitly', () => {
    const files = { 'audit-2026-05-01.log': new Date('2026-05-01T00:00:00.000Z').getTime() }
    const { result } = run({ files, clock: () => new Date('2026-05-01T00:02:00.000Z') })
    expect(result.deleted).toHaveLength(0)
    expect(result.kept).toEqual(['/d/audit-2026-05-01.log'])
  })

  it('preserves ordering for equal-mtime tie-breaks', () => {
    const files = {
      'audit-2026-05-01.log': NOW_MS - 10 * DAY_MS,
      'audit-2026-05-02.log': NOW_MS - 10 * DAY_MS,
      'audit-2026-05-03.log': NOW_MS - 10 * DAY_MS,
    }
    const { result } = run({ files, maxFiles: 1 })
    expect(result.deleted).toHaveLength(2)
    expect(result.kept).toHaveLength(1)
  })
})
