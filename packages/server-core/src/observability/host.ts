/**
 * Host-side composition root for the M.14 observability surface.
 *
 * `createHostAuditProducer` assembles `StructuredLogger + FileAuditSink +
 * AuditProducer + retention` into one chain and exposes the producer
 * for RBAC / mission handlers to inject. `dispose()` flushes pending
 * writes, runs a final retention sweep, and closes the file handle.
 *
 * Pure composition: T245/T246/T248/T249 surfaces are imported verbatim.
 * Clocks, home directory, log transport, file-sink construction, and
 * extra audit sinks are all injectable for `bun:test` exercise.
 */
import { homedir as defaultHomedir } from 'node:os'
import { join } from 'node:path'

import {
  type AuditEvent,
  type AuditProducer,
  type AuditSink,
  type Clock,
  type LogSink,
  type StructuredLogger,
  createAuditProducer,
  createStructuredLogger,
} from '@rox-one/shared/observability'

import { type FileAuditSinkHandle, createFileAuditSink } from './file-audit-sink.ts'

const DAY_MS = 24 * 60 * 60 * 1000

/** Default retention window: 90 days. */
export const DEFAULT_HOST_MAX_AGE_MS = 90 * DAY_MS
/** Default rotated-file cap: 60 files. */
export const DEFAULT_HOST_MAX_FILES = 60
/** Default subdirectory under `$HOME` for the audit trail. */
export const DEFAULT_HOST_LOG_DIR_NAME = '.rox'
/** Default filename for the active audit log inside `logDir`. */
export const DEFAULT_HOST_LOG_FILE_NAME = 'audit.log'

export interface HostRetentionOptions {
  /** Max age in ms for rotated files. Defaults to 90 days. */
  maxAgeMs?: number
  /** Max count of rotated files to keep. Defaults to 60. */
  maxFiles?: number
}

export interface CreateFileSinkArgs {
  path: string
  clock: Clock
  homedir: () => string
  maxAgeMs: number
  maxFiles: number
}

export interface CreateHostAuditProducerOptions {
  /** Directory holding the active audit log. Defaults to `${homedir()}/.rox`. */
  logDir?: string
  /** Override for the home directory lookup (test seam). */
  homedir?: () => string
  /** Retention policy (90-day / 60-file defaults). */
  retention?: HostRetentionOptions
  /** Clock injection. Defaults to `() => new Date()`. */
  clock?: Clock
  /** Structured-log transport. Defaults to a no-op (production opts in explicitly). */
  logSink?: LogSink
  /** Extra audit sinks fanned out alongside the FileAuditSink. */
  sinks?: AuditSink[]
  /** Test seam: inject a `FileAuditSinkHandle` factory. */
  createFileSink?: (args: CreateFileSinkArgs) => FileAuditSinkHandle
}

export interface HostAuditChain {
  /** The composed `AuditProducer` exposed to handlers. */
  producer: AuditProducer
  /**
   * Drains the file sink, runs a final retention sweep, and closes
   * the underlying write stream. Idempotent.
   */
  dispose(): Promise<void>
  /** Resolved absolute path to the active audit log (for diagnostics). */
  activeLogPath: string
  /** Underlying structured logger (for host wiring). */
  logger: StructuredLogger
  /** Force a retention sweep now (e.g. at boot). */
  enforceRetentionNow(): void
}

export function createHostAuditProducer(
  options: CreateHostAuditProducerOptions = {},
): HostAuditChain {
  const homedirFn = options.homedir ?? defaultHomedir
  const logDir = options.logDir ?? join(homedirFn(), DEFAULT_HOST_LOG_DIR_NAME)
  const activeLogPath = join(logDir, DEFAULT_HOST_LOG_FILE_NAME)
  const clock = options.clock ?? ((): Date => new Date())
  const maxAgeMs = options.retention?.maxAgeMs ?? DEFAULT_HOST_MAX_AGE_MS
  const maxFiles = options.retention?.maxFiles ?? DEFAULT_HOST_MAX_FILES

  const logger = createStructuredLogger({
    sink: options.logSink ?? ((): void => undefined),
    threshold: 'debug',
    clock,
  })

  const factory = options.createFileSink ?? defaultFileSinkFactory
  const fileSink = factory({
    path: activeLogPath,
    clock,
    homedir: homedirFn,
    maxAgeMs,
    maxFiles,
  })

  const extraSinks = options.sinks ?? []
  const fanOut: AuditSink = (event: AuditEvent): void => {
    // File sink runs first so the durable write is attempted before
    // best-effort in-memory consumers. Producer try/catches each call.
    fileSink.sink(event)
    for (const extra of extraSinks) {
      try {
        extra(event)
      } catch (err) {
        logger.error('audit.extraSinkError', { kind: event.kind, err })
      }
    }
  }

  const producer = createAuditProducer({ sink: fanOut, logger, clock })

  let disposed = false
  const dispose = async (): Promise<void> => {
    if (disposed) return
    disposed = true
    try {
      await fileSink.flush()
    } catch (err) {
      logger.error('audit.flushError', { err })
    }
    try {
      fileSink.enforceRetentionNow()
    } catch (err) {
      logger.error('audit.retentionError', { err })
    }
    await fileSink.close()
  }

  return {
    producer,
    dispose,
    activeLogPath,
    logger,
    enforceRetentionNow: (): void => {
      fileSink.enforceRetentionNow()
    },
  }
}

function defaultFileSinkFactory(args: CreateFileSinkArgs): FileAuditSinkHandle {
  return createFileAuditSink({
    path: args.path,
    clock: args.clock,
    homedir: args.homedir,
    retention: {
      maxAgeMs: args.maxAgeMs,
      maxFiles: args.maxFiles,
    },
  })
}
