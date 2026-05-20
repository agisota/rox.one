/**
 * PZD-79 G.2.2.1.C — env-var override gating primitive.
 *
 * Generalizes the env-var hardening pattern called out in audit findings
 * A-M1/A-M2: environment variables that influence integration behavior (e.g.
 * `ROX_DESIGN_WEB_URL`) must be honored only in development. In packaged
 * builds they are ignored and the suppressed read is logged at warn level so
 * ops can trace why a customer-environment-injected override did not apply.
 */
import { app } from 'electron'

export interface GatedEnvLogger {
  warn?: (message: string, meta?: Record<string, unknown>) => void
}

/** True in development (not packaged); false in shipped builds. */
export function isEnvOverrideAllowed(): boolean {
  return !app.isPackaged
}

/**
 * Read an environment variable, but only honor it in development. In packaged
 * builds returns undefined and logs a structured warn message if the env was
 * set (so a misconfigured deployment is observable).
 *
 * Returns the raw string value (no trim) when allowed; callers are responsible
 * for their own normalization to match existing per-integration semantics.
 */
export function readGatedEnv(name: string, logger?: GatedEnvLogger): string | undefined {
  if (isEnvOverrideAllowed()) {
    return process.env[name]
  }

  const suppressedValue = process.env[name]
  if (suppressedValue !== undefined) {
    logger?.warn?.('[integrations:env-policy] env override ignored in packaged build', {
      reason: 'env-overrides-disabled-in-production',
      name,
    })
  }
  return undefined
}
