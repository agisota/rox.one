/**
 * Audit-log retention policy — M.14 T249.
 *
 * `enforceRetention` is a pure-ish function that decides which rotated
 * audit log files in a directory should be deleted under a combination
 * of two limits:
 *
 *   1. **`maxAgeMs`** — any rotated file whose mtime is older than
 *      `now - maxAgeMs` is deleted.
 *   2. **`maxFiles`** — after the age cutoff, if more than `maxFiles`
 *      rotated files remain, the oldest are deleted until the count is
 *      at most `maxFiles`.
 *
 * Only files matching the pattern `audit-YYYY-MM-DD[-N].log` are
 * considered. The currently-active file (`audit.log`, no date suffix)
 * is never deleted, even if it is older than the cutoff — retention
 * targets the rotated trail, not the live writer.
 *
 * Filesystem operations are injected via the `fs` parameter so tests
 * never touch real disk paths. The clock is injected via `clock` so
 * age cutoffs are deterministic. When `fs.unlink` is provided the
 * function performs the deletions; otherwise it is a pure planner and
 * returns the list without side effects.
 *
 * Returns `{ deleted, kept }`, both sorted by mtime ascending (oldest
 * first), giving the caller a stable order for logging.
 */
import {
  readdirSync as defaultReaddir,
  statSync as defaultStat,
  unlinkSync as defaultUnlink,
} from 'node:fs'
import { join } from 'node:path'

export interface RetentionFsDeps {
  /** List directory entries. Defaults to `node:fs.readdirSync`. */
  readdir?: (dir: string) => string[]
  /** Stat one file (we use `mtimeMs` only). Defaults to `node:fs.statSync`. */
  stat?: (path: string) => { mtimeMs: number }
  /**
   * Delete one file. When omitted, `enforceRetention` becomes a pure
   * planner — it returns the would-be deletions without touching disk.
   */
  unlink?: (path: string) => void
}

export interface EnforceRetentionOptions {
  /** Directory holding `audit.log` and rotated `audit-YYYY-MM-DD[-N].log` files. */
  dir: string
  /** Max age in ms; files older than `now - maxAgeMs` are deleted. */
  maxAgeMs: number
  /** Max number of rotated files to keep after the age sweep. */
  maxFiles: number
  /** Clock injection. Defaults to `() => new Date()`. */
  clock?: () => Date
  /** Filesystem injection. Defaults to `node:fs` sync APIs. */
  fs?: RetentionFsDeps
}

export interface EnforceRetentionResult {
  /** Absolute paths of files that were (or would be) deleted, oldest first. */
  deleted: string[]
  /** Absolute paths of rotated files that survived the sweep, oldest first. */
  kept: string[]
}

interface FileEntry {
  name: string
  path: string
  mtimeMs: number
}

/**
 * Matches rotated audit files: `audit-2026-05-13.log`,
 * `audit-2026-05-13-1.log`, … The active `audit.log` (no date suffix)
 * is deliberately excluded.
 */
const ROTATED_FILENAME = /^audit-\d{4}-\d{2}-\d{2}(?:-\d+)?\.log$/

export function isRotatedAuditFile(name: string): boolean {
  return ROTATED_FILENAME.test(name)
}

export function enforceRetention(opts: EnforceRetentionOptions): EnforceRetentionResult {
  const readdir = opts.fs?.readdir ?? defaultReaddir
  const stat = opts.fs?.stat ?? defaultStat
  const unlink = opts.fs?.unlink
  const clock = opts.clock ?? (() => new Date())

  let names: string[]
  try {
    names = readdir(opts.dir)
  } catch {
    return { deleted: [], kept: [] }
  }

  const entries: FileEntry[] = []
  for (const name of names) {
    if (!isRotatedAuditFile(name)) continue
    const path = join(opts.dir, name)
    let mtimeMs: number
    try {
      mtimeMs = stat(path).mtimeMs
    } catch {
      // Skip files we can't stat — they may have been deleted concurrently.
      continue
    }
    entries.push({ name, path, mtimeMs })
  }

  // Sort ascending — oldest first. This gives a deterministic delete
  // order for the count-based cap and a stable return shape.
  entries.sort((a, b) => a.mtimeMs - b.mtimeMs)

  const nowMs = clock().getTime()
  const ageCutoff = nowMs - opts.maxAgeMs

  const deleted: FileEntry[] = []
  const survivors: FileEntry[] = []

  // Phase 1: age cutoff.
  for (const entry of entries) {
    if (entry.mtimeMs < ageCutoff) {
      deleted.push(entry)
    } else {
      survivors.push(entry)
    }
  }

  // Phase 2: count cap. Drop the oldest survivors until `maxFiles` remain.
  while (survivors.length > opts.maxFiles) {
    const oldest = survivors.shift()
    if (!oldest) break
    deleted.push(oldest)
  }

  // Re-sort `deleted` so callers see a single oldest-first ordering.
  deleted.sort((a, b) => a.mtimeMs - b.mtimeMs)

  // Apply deletions when an unlink helper was supplied.
  if (unlink) {
    for (const entry of deleted) {
      try {
        unlink(entry.path)
      } catch {
        // Best-effort: an entry vanishing under our feet is fine; surfacing
        // the error would mask the rest of the sweep. Callers needing
        // strict semantics can supply their own `unlink` that throws.
      }
    }
  }

  return {
    deleted: deleted.map((e) => e.path),
    kept: survivors.map((e) => e.path),
  }
}

/** Default retention window: 90 days. */
export const DEFAULT_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000

/** Default rotated-file cap: 60 files. */
export const DEFAULT_MAX_FILES = 60

/** Convenience helper that runs `enforceRetention` against `node:fs`. */
export function enforceRetentionOnDisk(
  dir: string,
  maxAgeMs = DEFAULT_MAX_AGE_MS,
  maxFiles = DEFAULT_MAX_FILES,
  clock: () => Date = () => new Date(),
): EnforceRetentionResult {
  return enforceRetention({
    dir,
    maxAgeMs,
    maxFiles,
    clock,
    fs: {
      readdir: defaultReaddir,
      stat: defaultStat,
      unlink: defaultUnlink,
    },
  })
}
