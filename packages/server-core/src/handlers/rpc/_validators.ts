/**
 * Boundary input validators for public RPC handlers (M.13 T303).
 *
 * Hand-rolled, zero-dependency parsers that narrow untrusted RPC payloads
 * into well-typed values before they reach domain logic. Each parser
 * throws an `Error & { code: 'INVALID_INPUT' }` on failure to match the
 * existing handler error shape used by `requireWorkspaceAccess` and
 * peers, which set `code = 'FORBIDDEN'` on the thrown Error.
 *
 * Why hand-rolled instead of zod: `@rox-one/server-core` does not
 * directly depend on `zod` and adding the dep edge is out of scope for
 * T303 per the no-new-deps rule. The parsers below are intentionally
 * narrow and only cover the high-risk handler surface from the audit
 * doc `docs/release/rpc-input-validation-audit.md`. T052/T071 will
 * introduce zod schemas for the broader RPC boundary when the dep edge
 * is approved.
 */

export type InvalidInputError = Error & { code: 'INVALID_INPUT' }

/** Make and throw a typed `INVALID_INPUT` error. */
export function invalidInput(message: string): never {
  const err = new Error(message) as InvalidInputError
  err.code = 'INVALID_INPUT'
  throw err
}

/**
 * Detect ASCII control chars 0x00..0x1F + 0x7F (DEL) — these have no
 * legitimate use in an id-like string and are the classic vector for
 * log injection, terminal escape smuggling, and NUL-truncation
 * filesystem attacks. Checked codepoint-by-codepoint to keep this file
 * free of literal control bytes.
 */
function hasControlChar(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i)
    if (code < 0x20 || code === 0x7f) return true
  }
  return false
}

/**
 * Parse a non-empty trimmable string. Rejects: not-a-string, empty,
 * whitespace-only, control chars (NUL etc.), > 256 chars.
 */
export function parseId(name: string, value: unknown): string {
  if (typeof value !== 'string') invalidInput(`${name} must be a string`)
  if (value.length === 0) invalidInput(`${name} must not be empty`)
  if (value.length > 256) invalidInput(`${name} must be <= 256 chars`)
  if (value.trim().length === 0) invalidInput(`${name} must not be whitespace-only`)
  if (hasControlChar(value)) {
    invalidInput(`${name} must not contain control characters`)
  }
  return value
}

/**
 * Parse a path-segment-safe slug. Stricter than `parseId`: rejects path
 * traversal tokens (`..`, leading `/`, leading `\`, backslash), so the
 * value is safe to pass into `path.join(rootPath, slug)`.
 */
export function parseSlug(name: string, value: unknown): string {
  const s = parseId(name, value)
  if (s.includes('..')) invalidInput(`${name} must not contain '..'`)
  if (s.startsWith('/') || s.startsWith('\\')) invalidInput(`${name} must not be absolute`)
  if (s.includes('\\')) invalidInput(`${name} must not contain backslashes`)
  if (s === '.' || s === '*') invalidInput(`${name} must not be a meta token`)
  return s
}

/**
 * Parse an optional string (undefined OK; null normalized to undefined).
 * Non-empty strings pass through `parseId` rules.
 */
export function parseOptionalString(name: string, value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined
  return parseId(name, value)
}

/** Parse `string[]` with size + per-element rules. */
export function parseStringArray(
  name: string,
  value: unknown,
  opts: { maxLen?: number; perItem?: (item: string) => string } = {},
): string[] {
  if (!Array.isArray(value)) invalidInput(`${name} must be an array`)
  const max = opts.maxLen ?? 1000
  if (value.length > max) invalidInput(`${name} must have <= ${max} entries`)
  const out: string[] = []
  for (let i = 0; i < value.length; i++) {
    const item = value[i]
    if (typeof item !== 'string') invalidInput(`${name}[${i}] must be a string`)
    const checked = opts.perItem ? opts.perItem(item) : parseId(`${name}[${i}]`, item)
    out.push(checked)
  }
  return out
}

/**
 * Discriminator string check — value must be one of an allow-list.
 * Used for action names, role types, and other enum-like fields.
 */
export function parseEnum<T extends string>(
  name: string,
  value: unknown,
  allowed: ReadonlyArray<T>,
): T {
  if (typeof value !== 'string') invalidInput(`${name} must be a string`)
  if (!allowed.includes(value as T)) {
    invalidInput(`${name} must be one of: ${allowed.join(', ')}`)
  }
  return value as T
}

/**
 * Parse a free-form string (e.g. message body, search query, token).
 * Rejects: not-a-string, control chars. Enforces an explicit max length.
 * Unlike `parseId`, allows leading/trailing whitespace and does NOT
 * require non-whitespace content (some free-form fields may be blank).
 */
export function parseSafeString(name: string, value: unknown, maxLen: number): string {
  if (typeof value !== 'string') invalidInput(`${name} must be a string`)
  if (value.length > maxLen) invalidInput(`${name} must be <= ${maxLen} chars`)
  if (hasControlChar(value)) invalidInput(`${name} must not contain control characters`)
  return value
}

/**
 * Parse an optional safe string (undefined/null pass through).
 * Non-null values run through `parseSafeString` rules.
 */
export function parseOptionalSafeString(name: string, value: unknown, maxLen: number): string | undefined {
  if (value === undefined || value === null) return undefined
  return parseSafeString(name, value, maxLen)
}

/**
 * Parse a URL string — must be a string, <= 2048 chars, parseable by the
 * `URL` constructor, and use only `http:` or `https:` scheme.
 * Used for webhook URLs and OAuth callback URLs.
 */
export function parseUrl(name: string, value: unknown): string {
  if (typeof value !== 'string') invalidInput(`${name} must be a string`)
  if (value.length === 0) invalidInput(`${name} must not be empty`)
  if (value.length > 2048) invalidInput(`${name} must be <= 2048 chars`)
  if (hasControlChar(value)) invalidInput(`${name} must not contain control characters`)
  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    invalidInput(`${name} must be a valid URL`)
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    invalidInput(`${name} must use http or https scheme`)
  }
  return value
}

/**
 * Parse an optional URL string (undefined/null pass through).
 */
export function parseOptionalUrl(name: string, value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined
  return parseUrl(name, value)
}

// ---------------------------------------------------------------------------
// Per-handler payload schemas
// ---------------------------------------------------------------------------

/**
 * `CreateLabelInput` boundary schema for `labels.CREATE`.
 *
 * Mirrors `@rox-one/shared/labels::CreateLabelInput` at the wire layer:
 *   { name: string; color?: EntityColor; parentId?: string | null }
 *
 * `EntityColor` (`@rox-one/shared/colors/types`) is either a `SystemColor`
 * string ("accent", "info/80", …) or a `CustomColor` object
 * (`{ light: string; dark?: string }`). The boundary parser shape-checks
 * both variants and rejects unknown shapes — it does not exhaustively
 * validate the system-color enum or hex/oklch grammar (that belongs in
 * the shared colors module and is enforced downstream).
 */
export interface ParsedCreateLabelInput {
  name: string
  color?: string | { light: string; dark?: string }
  parentId?: string | null
}

function parseColorString(value: string, fieldName: string): string {
  if (value.length === 0) invalidInput(`${fieldName} must not be empty`)
  if (value.length > 64) invalidInput(`${fieldName} must be <= 64 chars`)
  if (hasControlChar(value)) {
    invalidInput(`${fieldName} must not contain control characters`)
  }
  return value
}

function parseColor(value: unknown): ParsedCreateLabelInput['color'] {
  if (value === undefined || value === null) return undefined
  if (typeof value === 'string') return parseColorString(value, 'CreateLabelInput.color')
  if (typeof value !== 'object') {
    invalidInput('CreateLabelInput.color must be a string or an object')
  }
  const obj = value as Record<string, unknown>
  if (typeof obj.light !== 'string') {
    invalidInput('CreateLabelInput.color.light must be a string')
  }
  const light = parseColorString(obj.light as string, 'CreateLabelInput.color.light')
  let dark: string | undefined
  if (obj.dark !== undefined && obj.dark !== null) {
    if (typeof obj.dark !== 'string') {
      invalidInput('CreateLabelInput.color.dark must be a string')
    }
    dark = parseColorString(obj.dark as string, 'CreateLabelInput.color.dark')
  }
  return dark === undefined ? { light } : { light, dark }
}

export function parseCreateLabelInput(value: unknown): ParsedCreateLabelInput {
  if (typeof value !== 'object' || value === null) {
    invalidInput('CreateLabelInput must be an object')
  }
  const obj = value as Record<string, unknown>
  const name = parseId('CreateLabelInput.name', obj.name)
  const color = parseColor(obj.color)
  let parentId: string | null | undefined
  if (obj.parentId === null) {
    parentId = null
  } else if (obj.parentId !== undefined) {
    parentId = parseId('CreateLabelInput.parentId', obj.parentId)
  }
  return { name, color, parentId }
}
