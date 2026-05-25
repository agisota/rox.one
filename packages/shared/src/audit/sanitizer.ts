/**
 * WT-08 — Recursive payload sanitizer.
 *
 * Used as the canonical pre-hash redaction for `logger.audit()` and
 * `logger.telemetry()`. Complements the legacy in-place sanitizer in
 * `audit-event-store.ts` (which the existing writer still uses for its file
 * backend) by providing:
 *   1. Key-based redaction (token / secret / password / cookie / authorization
 *      / api_key / bearer / refresh_token / access_token, case-insensitive)
 *   2. Value-pattern detection (JWT-like, hex32+, base64 40+)
 *   3. Circular-reference safe deep clone
 *   4. Configurable rules (default + extra keys / extra patterns)
 */

export const REDACTED_PLACEHOLDER = '[REDACTED]'

const DEFAULT_KEY_PATTERNS: ReadonlyArray<RegExp> = [
  /^token$/i,
  /^secret$/i,
  /^password$/i,
  /^cookie$/i,
  /^authorization$/i,
  /^bearer$/i,
  /^api[_-]?key$/i,
  /^refresh[_-]?token$/i,
  /^access[_-]?token$/i,
  /^client[_-]?secret$/i,
  /^private[_-]?key$/i,
]

const JWT_REGEX = /^eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+$/
const HEX_LONG_REGEX = /^[a-f0-9]{32,}$/
const BASE64_LONG_REGEX = /^[A-Za-z0-9+/=]{40,}$/

const DEFAULT_VALUE_PATTERNS: ReadonlyArray<RegExp> = [
  JWT_REGEX,
  HEX_LONG_REGEX,
  BASE64_LONG_REGEX,
]

export interface SanitizerOptions {
  /** Additional key regexes to redact (case-insensitive expected). */
  readonly extraKeyPatterns?: ReadonlyArray<RegExp>
  /** Additional value regexes to redact. */
  readonly extraValuePatterns?: ReadonlyArray<RegExp>
}

/**
 * Recursively sanitize a payload, returning a new structure with sensitive
 * keys/values replaced by `[REDACTED]`. The input is not mutated. Circular
 * references are detected and replaced with `'[CIRCULAR]'`.
 */
export function sanitizePayload<T>(input: T, options: SanitizerOptions = {}): T {
  const keyPatterns = [...DEFAULT_KEY_PATTERNS, ...(options.extraKeyPatterns ?? [])]
  const valuePatterns = [...DEFAULT_VALUE_PATTERNS, ...(options.extraValuePatterns ?? [])]
  const seen = new WeakMap<object, unknown>()
  return walk(input, '', keyPatterns, valuePatterns, seen) as T
}

function walk(
  value: unknown,
  parentKey: string,
  keyPatterns: ReadonlyArray<RegExp>,
  valuePatterns: ReadonlyArray<RegExp>,
  seen: WeakMap<object, unknown>,
): unknown {
  if (parentKey && matchesAny(parentKey, keyPatterns)) {
    return REDACTED_PLACEHOLDER
  }

  if (typeof value === 'string') {
    return matchesAny(value, valuePatterns) ? REDACTED_PLACEHOLDER : value
  }

  if (value === null || typeof value !== 'object') return value

  const existing = seen.get(value as object)
  if (existing !== undefined) return '[CIRCULAR]'

  if (Array.isArray(value)) {
    const placeholder: unknown[] = []
    seen.set(value, placeholder)
    for (const item of value) {
      placeholder.push(walk(item, '', keyPatterns, valuePatterns, seen))
    }
    return placeholder
  }

  const out: Record<string, unknown> = {}
  seen.set(value as object, out)
  for (const [childKey, childValue] of Object.entries(value as Record<string, unknown>)) {
    out[childKey] = walk(childValue, childKey, keyPatterns, valuePatterns, seen)
  }
  return out
}

function matchesAny(value: string, patterns: ReadonlyArray<RegExp>): boolean {
  for (const pattern of patterns) {
    if (pattern.test(value)) return true
  }
  return false
}

/** Exposed for tests / advanced callers — the default key+value patterns. */
export const DEFAULT_SANITIZER_PATTERNS = {
  keyPatterns: DEFAULT_KEY_PATTERNS,
  valuePatterns: DEFAULT_VALUE_PATTERNS,
} as const
