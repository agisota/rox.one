const SENSITIVE_PUBLIC_PAYLOAD_KEY = /(?:authorization|cookie|set-cookie|api[-_]?key|access[-_]?token|refresh[-_]?token|id[-_]?token|bearer|password|secret|rox_session|session[-_]?cookie|session[-_]?token)/i

const SECRET_STRING_PATTERNS: Array<[RegExp, string]> = [
  [/\bBearer\s+[-A-Za-z0-9._~+/=]+/gi, 'Bearer [redacted]'],
  [
    /\b([A-Z0-9_]*(?:TOKEN|API[_-]?KEY|SECRET|PASSWORD|COOKIE|SESSION)[A-Z0-9_]*|rox_session|password|cookie|token|api[_-]?key)\s*=\s*([^;\s\r\n]+)/gi,
    '$1=[redacted]',
  ],
  [/\bsk-[A-Za-z0-9_-]{8,}\b/g, '[redacted-api-key]'],
]

export interface SanitizePublicPayloadOptions {
  dropSensitiveKeys?: boolean
}

export function redactPublicSecretString(value: string): string {
  return SECRET_STRING_PATTERNS.reduce(
    (current, [pattern, replacement]) => current.replace(pattern, replacement),
    value,
  )
}

export function sanitizePublicPayload<T>(value: T, options: SanitizePublicPayloadOptions = {}): T {
  if (typeof value === 'string') {
    return redactPublicSecretString(value) as T
  }

  if (Array.isArray(value)) {
    return value.map(item => sanitizePublicPayload(item, options)) as T
  }

  if (!value || typeof value !== 'object') {
    return value
  }

  const output: Record<string, unknown> = {}
  for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_PUBLIC_PAYLOAD_KEY.test(key)) {
      if (options.dropSensitiveKeys) continue
      output[key] = '[redacted]'
      continue
    }
    output[key] = sanitizePublicPayload(nestedValue, options)
  }

  return output as T
}
