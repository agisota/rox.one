/**
 * Structured logger surface for the M.14 observability producer.
 *
 * Design goals:
 * - Pure sink injection. The logger never touches stdio / fs / console;
 *   call-site adapters in T246 own the transport.
 * - Correlation propagation. Records stamp themselves with whatever
 *   `currentCorrelationId()` returns at emission time.
 * - Best-effort. A throwing sink must never crash the caller; logging is
 *   ancillary to whatever the caller is actually doing.
 * - Clock injection. Tests stamp deterministic timestamps; production
 *   code passes `() => new Date()`.
 */
import { type CorrelationId, currentCorrelationId } from './correlation.ts'
import { type LogLevel, assertLogLevel, shouldLog } from './log-level.ts'

/**
 * Structured field bag carried on a log record. Values may be anything
 * JSON-serialisable; `Error` instances are normalised into `{ name, message,
 * stack }` at emission time so the sink never has to special-case them.
 */
export type LogFields = Record<string, unknown>

/**
 * The record shape passed to a `LogSink`. Keys are stable and the order is
 * deterministic so downstream consumers (renderer, file sink, OTLP exporter)
 * can rely on a single schema.
 */
export interface LogRecord {
  level: LogLevel
  ts: string
  message: string
  fields: LogFields
  correlationId?: CorrelationId
}

/**
 * A sink is a pure receiver of records. Implementations must never throw
 * upward (the logger guards against this, but well-behaved sinks should
 * also self-isolate failure).
 */
export type LogSink = (record: LogRecord) => void

/**
 * Clock factory injected into the logger. Returning a fresh `Date` per call
 * keeps the surface trivially testable.
 */
export type Clock = () => Date

export interface CreateStructuredLoggerOptions {
  sink: LogSink
  threshold: LogLevel
  clock: Clock
}

interface ChildOptions {
  threshold?: LogLevel
}

/**
 * The producer-side logger interface. Each level method has the same
 * `(message, fields?)` shape so call sites read uniformly.
 */
export interface StructuredLogger {
  trace(message: string, fields?: LogFields): void
  debug(message: string, fields?: LogFields): void
  info(message: string, fields?: LogFields): void
  warn(message: string, fields?: LogFields): void
  error(message: string, fields?: LogFields): void
  fatal(message: string, fields?: LogFields): void
  log(level: LogLevel, message: string, fields?: LogFields): void
  child(boundFields: LogFields, options?: ChildOptions): StructuredLogger
}

interface LoggerCore {
  sink: LogSink
  clock: Clock
}

export function createStructuredLogger(options: CreateStructuredLoggerOptions): StructuredLogger {
  const threshold = assertLogLevel(options.threshold)
  const core: LoggerCore = { sink: options.sink, clock: options.clock }
  return buildLogger(core, threshold, {})
}

function buildLogger(
  core: LoggerCore,
  threshold: LogLevel,
  boundFields: LogFields,
): StructuredLogger {
  const log = (level: LogLevel, message: string, fields?: LogFields): void => {
    if (!shouldLog(threshold, level)) return

    const record: LogRecord = {
      level,
      ts: core.clock().toISOString(),
      message,
      fields: mergeFields(boundFields, fields),
    }

    const cid = currentCorrelationId()
    if (cid !== undefined) {
      record.correlationId = cid
    }

    try {
      core.sink(record)
    } catch {
      // logging is best-effort; never propagate sink failures to the caller.
    }
  }

  return {
    trace: (message, fields) => log('trace', message, fields),
    debug: (message, fields) => log('debug', message, fields),
    info: (message, fields) => log('info', message, fields),
    warn: (message, fields) => log('warn', message, fields),
    error: (message, fields) => log('error', message, fields),
    fatal: (message, fields) => log('fatal', message, fields),
    log,
    child(extraBound, childOptions) {
      const nextThreshold = childOptions?.threshold
        ? assertLogLevel(childOptions.threshold)
        : threshold
      return buildLogger(core, nextThreshold, mergeFields(boundFields, extraBound))
    },
  }
}

function mergeFields(base: LogFields, extra: LogFields | undefined): LogFields {
  const merged: LogFields = {}
  for (const [k, v] of Object.entries(base)) {
    merged[k] = normaliseValue(v)
  }
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      merged[k] = normaliseValue(v)
    }
  }
  return merged
}

function normaliseValue(value: unknown): unknown {
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack }
  }
  return value
}
