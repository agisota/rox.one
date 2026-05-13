declare const BRAND: unique symbol

/**
 * Branded string identifying one end-to-end span. Use {@link asCorrelationId}
 * to construct (validates non-empty).
 */
export type CorrelationId = string & { readonly [BRAND]: 'CorrelationId' }

/**
 * Brand a raw string as a `CorrelationId`. Empty / whitespace-only strings
 * are rejected so that an event can never be silently emitted without a span.
 */
export function asCorrelationId(value: string): CorrelationId {
  const trimmed = value.trim()
  if (trimmed.length === 0) {
    throw new Error('asCorrelationId: value is empty or whitespace-only')
  }
  return trimmed as CorrelationId
}
