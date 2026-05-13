/**
 * FileAuditSink — default implementation of the M.14 `AuditSink` interface.
 *
 * Writes one JSON object per line (NDJSON) to a configurable path, defaulting
 * to `${homedir()}/.rox/audit.log`. Two rotation triggers fire before each
 * write:
 *
 *   1. **Daily (UTC)** — when the calendar day of the first line's `ts` no
 *      longer matches today's UTC day, the current file is renamed to
 *      `audit-YYYY-MM-DD.log` (the date harvested from the first line). A
 *      fresh file is then created.
 *
 *   2. **Size cap** — when the current file's size meets or exceeds
 *      `maxSizeBytes` (default 10 MB), the file is renamed to
 *      `audit-YYYY-MM-DD.log` (today's UTC day) and a fresh file is created.
 *
 * On naming collisions a numeric suffix is appended (e.g.
 * `audit-2026-05-13-1.log`) so no historic data is overwritten.
 *
 * The sink maintains a small in-memory queue. `sink()` is fire-and-forget;
 * `flush()` returns a promise that resolves once the queue is drained and
 * every byte has been handed to the kernel. Tests inject `clock` and
 * `homedir` so rotation behaviour is deterministic and `$HOME` is never
 * touched.
 *
 * Source budget: ≤300 LOC. External deps: none — Node built-ins
 * `node:fs`, `node:path`, `node:os` only.
 */
import {
  closeSync,
  createWriteStream,
  existsSync,
  mkdirSync,
  openSync,
  readSync,
  readdirSync,
  renameSync,
  statSync,
  unlinkSync,
  type WriteStream,
} from 'node:fs'
import { homedir as defaultHomedir } from 'node:os'
import { dirname, join } from 'node:path'

import { type AuditEvent, type AuditSink } from '@rox-one/shared/observability'

import {
  enforceRetention,
  type EnforceRetentionResult,
  type RetentionFsDeps,
} from './audit-retention.ts'

const DEFAULT_MAX_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB
const DEFAULT_FILE_NAME = 'audit.log'
const DEFAULT_DIR_NAME = '.rox'
const HEAD_PROBE_BYTES = 4096

export interface FileAuditSinkRetention {
  /** Max age in ms for rotated files (older entries are deleted). */
  maxAgeMs: number
  /** Max count of rotated files to keep after the age sweep. */
  maxFiles: number
  /** Filesystem injection for the sweep (test seam). Defaults to `node:fs`. */
  fs?: RetentionFsDeps
}

export interface FileAuditSinkOptions {
  /** Absolute path to the active audit log. Defaults to `${homedir()}/.rox/audit.log`. */
  path?: string
  /** Override for the home directory lookup (test seam). */
  homedir?: () => string
  /** Clock injection. Defaults to `() => new Date()`. */
  clock?: () => Date
  /** Size in bytes at or above which the file is rotated. Default 10 MB. */
  maxSizeBytes?: number
  /**
   * Optional retention policy. When set, `enforceRetention` runs after
   * every rotation. When absent, rotated files accumulate indefinitely
   * (backward-compatible with T248).
   */
  retention?: FileAuditSinkRetention
}

export interface FileAuditSinkHandle {
  /** Pure-function audit sink suitable for `createAuditProducer({ sink })`. */
  sink: AuditSink
  /** Resolves once every queued event has been written to disk. */
  flush(): Promise<void>
  /** Drains the queue and closes the underlying write stream. Subsequent `sink()` calls throw. */
  close(): Promise<void>
  /** Returns the currently active log path (resolved from defaults). */
  activePath(): string
  /**
   * Force a retention sweep now (no-op when no `retention` was supplied
   * at construction time). Returns the per-file outcome for logging.
   */
  enforceRetentionNow(): EnforceRetentionResult
}

interface InternalState {
  path: string
  clock: () => Date
  maxSizeBytes: number
  stream: WriteStream | null
  queue: string[]
  draining: Promise<void> | null
  closed: boolean
  pendingError: Error | null
  retention: FileAuditSinkRetention | null
}

export function createFileAuditSink(options: FileAuditSinkOptions = {}): FileAuditSinkHandle {
  const homedirFn = options.homedir ?? defaultHomedir
  const path = options.path ?? join(homedirFn(), DEFAULT_DIR_NAME, DEFAULT_FILE_NAME)
  const state: InternalState = {
    path,
    clock: options.clock ?? (() => new Date()),
    maxSizeBytes: options.maxSizeBytes ?? DEFAULT_MAX_SIZE_BYTES,
    stream: null,
    queue: [],
    draining: null,
    closed: false,
    pendingError: null,
    retention: options.retention ?? null,
  }

  const handle: FileAuditSinkHandle = {
    sink(event: AuditEvent): void {
      if (state.closed) {
        throw new Error('file-audit-sink: sink is closed')
      }
      const line = serialise(event)
      state.queue.push(line)
      void scheduleDrain(state)
    },
    flush(): Promise<void> {
      return drainAndFlush(state)
    },
    async close(): Promise<void> {
      if (state.closed) return
      state.closed = true
      await drainAndFlush(state)
      await closeStream(state)
    },
    activePath(): string {
      return state.path
    },
    enforceRetentionNow(): EnforceRetentionResult {
      return runRetention(state)
    },
  }
  return handle
}

function runRetention(state: InternalState): EnforceRetentionResult {
  if (!state.retention) return { deleted: [], kept: [] }
  // Default to real `node:fs` ops including `unlink` so the sweep
  // actually deletes files. Tests override via `retention.fs`.
  const fs: RetentionFsDeps = state.retention.fs ?? {
    readdir: readdirSync,
    stat: statSync,
    unlink: unlinkSync,
  }
  return enforceRetention({
    dir: dirname(state.path),
    maxAgeMs: state.retention.maxAgeMs,
    maxFiles: state.retention.maxFiles,
    clock: state.clock,
    fs,
  })
}

function serialise(event: AuditEvent): string {
  return JSON.stringify(event) + '\n'
}

function ensureParentDir(filePath: string): void {
  const parent = dirname(filePath)
  if (!existsSync(parent)) {
    mkdirSync(parent, { recursive: true })
  }
}

function scheduleDrain(state: InternalState): Promise<void> {
  if (state.draining) return state.draining
  state.draining = (async () => {
    try {
      while (state.queue.length > 0) {
        const batch = state.queue.splice(0, state.queue.length)
        rotateIfNeeded(state)
        const stream = openStream(state)
        for (const line of batch) {
          await writeOne(stream, line)
        }
      }
    } catch (err) {
      state.pendingError = err instanceof Error ? err : new Error(String(err))
    } finally {
      state.draining = null
    }
  })()
  return state.draining
}

function writeOne(stream: WriteStream, line: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // The callback fires once the chunk has been handed to the kernel.
    stream.write(line, (err) => {
      if (err) {
        reject(err)
        return
      }
      resolve()
    })
  })
}

async function drainAndFlush(state: InternalState): Promise<void> {
  // Drain in a loop because new events may arrive while we await.
  for (let i = 0; i < 8; i++) {
    if (state.draining) {
      await state.draining
    }
    if (state.queue.length === 0) break
    void scheduleDrain(state)
  }
  if (state.pendingError) {
    const err = state.pendingError
    state.pendingError = null
    throw err
  }
}

function closeStream(state: InternalState): Promise<void> {
  return new Promise((resolve) => {
    const stream = state.stream
    state.stream = null
    if (!stream) {
      resolve()
      return
    }
    stream.end(() => resolve())
  })
}

function openStream(state: InternalState): WriteStream {
  if (state.stream) return state.stream
  ensureParentDir(state.path)
  const stream = createWriteStream(state.path, { flags: 'a' })
  state.stream = stream
  return stream
}

function rotateIfNeeded(state: InternalState): void {
  if (!existsSync(state.path)) return
  const now = state.clock()
  const todayUtc = toUtcDateString(now)
  const headDate = peekHeadDate(state.path)
  if (headDate && headDate !== todayUtc) {
    rotateTo(state, headDate)
    runRetention(state)
    return
  }
  const size = sizeOf(state.path)
  if (size >= state.maxSizeBytes) {
    rotateTo(state, todayUtc)
    runRetention(state)
  }
}

function sizeOf(filePath: string): number {
  try {
    return statSync(filePath).size
  } catch {
    return 0
  }
}

function rotateTo(state: InternalState, dateStamp: string): void {
  // Detach the current stream so the rename targets a quiescent file.
  if (state.stream) {
    state.stream.end()
    state.stream = null
  }
  const dir = dirname(state.path)
  let candidate = join(dir, `audit-${dateStamp}.log`)
  let suffix = 1
  while (existsSync(candidate)) {
    candidate = join(dir, `audit-${dateStamp}-${suffix}.log`)
    suffix += 1
  }
  renameSync(state.path, candidate)
}

function peekHeadDate(filePath: string): string | null {
  let fd: number | null = null
  try {
    fd = openSync(filePath, 'r')
    const buf = Buffer.alloc(HEAD_PROBE_BYTES)
    const read = readSync(fd, buf, 0, HEAD_PROBE_BYTES, 0)
    if (read <= 0) return null
    const slice = buf.subarray(0, read).toString('utf8')
    const nl = slice.indexOf('\n')
    const firstLine = nl === -1 ? slice : slice.slice(0, nl)
    if (firstLine.length === 0) return null
    try {
      const parsed = JSON.parse(firstLine) as { ts?: unknown }
      if (typeof parsed.ts === 'string') {
        const dateStamp = toUtcDateString(new Date(parsed.ts))
        if (dateStamp.length === 10) return dateStamp
      }
    } catch {
      return null
    }
    return null
  } catch {
    return null
  } finally {
    if (fd !== null) {
      try {
        closeSync(fd)
      } catch {
        // ignore
      }
    }
  }
}

function toUtcDateString(date: Date): string {
  if (Number.isNaN(date.getTime())) return ''
  const y = date.getUTCFullYear().toString().padStart(4, '0')
  const m = (date.getUTCMonth() + 1).toString().padStart(2, '0')
  const d = date.getUTCDate().toString().padStart(2, '0')
  return `${y}-${m}-${d}`
}
