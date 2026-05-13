/**
 * Canonical log-level taxonomy for the observability producer surface.
 *
 * Levels are ordered from least to most severe: a logger configured with
 * threshold `warn` will emit events at `warn | error | fatal` and drop
 * `trace | debug | info`. Numeric ranks are returned by `logLevelRank()`;
 * use `shouldLog(threshold, level)` for predicate-style gating.
 */

export const LOG_LEVELS = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'] as const

export type LogLevel = (typeof LOG_LEVELS)[number]

const RANKS: Readonly<Record<LogLevel, number>> = {
  trace: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
  fatal: 5,
}

/**
 * Map a `LogLevel` to its numeric rank. Lower = less severe; ranks are
 * strictly increasing along `LOG_LEVELS`.
 */
export function logLevelRank(level: LogLevel): number {
  return RANKS[level]
}

/**
 * Compare two levels by severity. Returns a negative number when `left` is
 * less severe, positive when more severe, and zero when both match.
 */
export function compareLogLevels(left: LogLevel, right: LogLevel): number {
  return RANKS[left] - RANKS[right]
}

/**
 * Predicate: should an event at `level` be emitted when the logger is
 * configured with `threshold`? `true` when `level` is at least as severe
 * as `threshold`.
 */
export function shouldLog(threshold: LogLevel, level: LogLevel): boolean {
  return RANKS[level] >= RANKS[threshold]
}

/**
 * Runtime guard: narrow an unknown input to `LogLevel`.
 */
export function isLogLevel(value: unknown): value is LogLevel {
  return typeof value === 'string' && (LOG_LEVELS as readonly string[]).includes(value)
}

/**
 * Assertive variant: throw on unknown levels. Used at construction sites that
 * cannot fail open (e.g. logger / producer factories).
 */
export function assertLogLevel(value: unknown): LogLevel {
  if (!isLogLevel(value)) {
    throw new Error(`assertLogLevel: not a known log level: ${String(value)}`)
  }
  return value
}
