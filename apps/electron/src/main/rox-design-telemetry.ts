/**
 * rox-design-telemetry.ts — PZD-82
 *
 * Structured error logging + Sentry breadcrumb helpers for Rox Design lifecycle
 * code. Replaces the previous silent `.catch(() => {})` swallow pattern with a
 * single observable spot per lifecycle phase, tagged with the integration name
 * so future Vision/X integrations follow the same telemetry contract.
 *
 * Constraints:
 *   - Pure shim around the existing electron-log scoped logger + @sentry/electron.
 *     No new dependency is introduced.
 *   - Lazily resolves Sentry so this module can be imported in headless test
 *     environments where the @sentry/electron/main entry point is mocked or
 *     absent.
 *   - Never logs secrets. The {@link scrubContext} helper drops keys whose
 *     names suggest credentials and shortens raw URLs to their origin + path,
 *     stripping any query string (a common carrier for one-time tokens).
 */

/**
 * Tag attached to every structured log line and Sentry breadcrumb produced by
 * this module. Future framework integrations (Vision/Studio, X/Mock-up, etc.)
 * MUST follow the same shape: `category: 'rox-design'` becomes `category:
 * 'rox-vision'` etc., but the rest of the contract stays identical.
 */
export const ROX_DESIGN_INTEGRATION_TAG = 'rox-design' as const

/**
 * Minimal scoped logger surface used by the rox-design subsystem. Matches the
 * shape already accepted by {@link RoxDesignRuntimeManager} and
 * {@link RoxDesignViewManager}, so callers can pass the same logger instance.
 */
export interface RoxDesignTelemetryLogger {
  info?: (message: string, meta?: Record<string, unknown>) => void
  warn?: (message: string, meta?: Record<string, unknown>) => void
  error?: (message: string, meta?: Record<string, unknown>) => void
}

/**
 * Subset of the @sentry/electron API we depend on. Kept narrow so the test
 * harness can substitute an in-memory sink.
 */
export interface RoxDesignSentryClient {
  addBreadcrumb: (breadcrumb: {
    category?: string
    level?: 'debug' | 'info' | 'warning' | 'error' | 'fatal'
    message?: string
    data?: Record<string, unknown>
  }) => void
}

let sentryOverride: RoxDesignSentryClient | null = null

/**
 * Test hook: inject a synchronous Sentry sink. Production code never sets
 * this; tests use it to capture breadcrumbs without booting the real client.
 */
export function __setRoxDesignSentryClient(client: RoxDesignSentryClient | null): void {
  sentryOverride = client
}

function getSentry(): RoxDesignSentryClient | null {
  if (sentryOverride) return sentryOverride
  try {
    // Lazily resolve the real client so this module is safe to import in
    // headless Bun tests that mock the 'electron' module but not '@sentry'.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sentry = require('@sentry/electron/main') as RoxDesignSentryClient
    return sentry && typeof sentry.addBreadcrumb === 'function' ? sentry : null
  } catch {
    return null
  }
}

const SENSITIVE_KEY_PATTERNS = [
  'token',
  'secret',
  'password',
  'credential',
  'auth',
  'cookie',
  'apikey',
  'api-key',
  'authorization',
] as const

function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase()
  return SENSITIVE_KEY_PATTERNS.some((needle) => lower.includes(needle))
}

/**
 * Replace a raw URL with `origin + pathname` so query strings (which often
 * carry one-time tokens like `?desktopAuth=…`) never leak into logs. Returns
 * the original input for non-string / un-parseable values.
 */
function scrubUrl(value: unknown): unknown {
  if (typeof value !== 'string') return value
  try {
    const parsed = new URL(value)
    return `${parsed.origin}${parsed.pathname}`
  } catch {
    return value
  }
}

/**
 * Strip secrets/PII from a context object before it crosses the log boundary.
 * Drops sensitive keys entirely; trims known URL-bearing keys to origin+path.
 */
export function scrubContext(context: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!context) return {}
  const cleaned: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(context)) {
    if (isSensitiveKey(key)) continue
    if (key === 'url' || key === 'webUrl' || key === 'daemonUrl' || key === 'validatedURL') {
      cleaned[key] = scrubUrl(value)
      continue
    }
    cleaned[key] = value
  }
  return cleaned
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  try {
    return JSON.stringify(error)
  } catch {
    return String(error)
  }
}

export interface RoxDesignErrorSpanInput {
  /** Lifecycle phase, e.g. 'start', 'view-show', 'before-quit-cleanup'. */
  phase: string
  /** The error caught. May be any thrown value. */
  error: unknown
  /** Scoped logger (typically mainLog). Optional in test paths. */
  logger?: RoxDesignTelemetryLogger
  /** Structured context — must not contain secrets/PII. */
  context?: Record<string, unknown>
  /** Severity. Defaults to 'error'. Use 'warn' for non-fatal recoveries. */
  level?: 'warn' | 'error'
}

/**
 * Record a structured failure for a Rox Design lifecycle phase.
 *
 * Side-effects:
 *  1. Writes one structured `logger.{warn|error}` entry containing the
 *     integration tag, phase, error message and scrubbed context.
 *  2. Adds one Sentry breadcrumb so the next captured exception carries the
 *     trail of lifecycle failures (Sentry calls are no-ops in environments
 *     where the client is not initialised).
 *
 * Returns silently; the caller's promise chain continues unchanged so this
 * helper can be dropped in wherever a `.catch(() => undefined)` previously
 * lived.
 */
export function recordRoxDesignError(input: RoxDesignErrorSpanInput): void {
  const { phase, error, logger, context, level = 'error' } = input
  const message = `[${ROX_DESIGN_INTEGRATION_TAG}.${phase}] ${errorMessage(error)}`
  const safeContext = scrubContext(context)
  const meta: Record<string, unknown> = {
    integration: ROX_DESIGN_INTEGRATION_TAG,
    phase,
    error: errorMessage(error),
    ...safeContext,
  }

  if (level === 'warn') logger?.warn?.(message, meta)
  else logger?.error?.(message, meta)

  const sentry = getSentry()
  sentry?.addBreadcrumb({
    category: ROX_DESIGN_INTEGRATION_TAG,
    data: {
      integration: ROX_DESIGN_INTEGRATION_TAG,
      phase,
      error: errorMessage(error),
      ...safeContext,
    },
    level: level === 'warn' ? 'warning' : 'error',
    message: `${phase}-failed`,
  })
}

/**
 * Convenience wrapper that returns a `.catch` handler bound to a given phase
 * and logger. Lets the caller stay concise:
 *
 * ```ts
 * webContents.executeJavaScript(code).catch(catchRoxDesignError({
 *   phase: 'theme-bridge-post-snapshot',
 *   logger,
 * }))
 * ```
 */
export function catchRoxDesignError(
  options: Omit<RoxDesignErrorSpanInput, 'error'> & { context?: Record<string, unknown> },
): (error: unknown) => void {
  return (error: unknown) => recordRoxDesignError({ ...options, error })
}
