/**
 * Shared logging helpers for the Web UI subsystem.
 *
 * These utilities exist to keep PII out of structured logs while still
 * leaving enough information for operators to triage incidents. We
 * deliberately keep them tiny and dependency-free so they can be inlined
 * anywhere a `logger.info` call would otherwise interpolate raw user
 * material (email addresses, names, etc).
 */

/**
 * Mask an email address for logging.
 *
 * Returns the first character of the local-part, three asterisks, and the
 * full domain. The domain is preserved so operators can still reason about
 * deliverability problems and inbound traffic shape without exposing the
 * specific account holder.
 *
 * Defensive behaviour:
 *   - Empty / non-string / missing `@` inputs collapse to `"[redacted-email]"`
 *     rather than throwing — log sites must never crash because of a malformed
 *     argument.
 *   - The local-part is reduced to a single leading character; we never
 *     leak the rest of the local-part even if it is short. This is stricter
 *     than typical "show first + last char" masks because, in practice, two
 *     letters of the local-part is enough to re-identify a known user from
 *     a small tenant.
 */
export function maskEmail(email: string | null | undefined): string {
  if (typeof email !== 'string' || email.length === 0) return '[redacted-email]'
  const atIndex = email.indexOf('@')
  if (atIndex <= 0 || atIndex === email.length - 1) return '[redacted-email]'
  const local = email.slice(0, atIndex)
  const domain = email.slice(atIndex + 1)
  return `${local.charAt(0)}***@${domain}`
}
