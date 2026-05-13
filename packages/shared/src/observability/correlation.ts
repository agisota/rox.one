/**
 * Correlation-id propagation primitives for the observability producer surface.
 *
 * A `CorrelationId` is a branded `string` that identifies a single end-to-end
 * span (e.g. one user request, one mission tick, one webhook delivery). The
 * id is propagated across `await` boundaries via `node:async_hooks`
 * `AsyncLocalStorage`, so any log line or audit event emitted inside a
 * `withCorrelationId(...)` scope can automatically stamp itself with the
 * surrounding id without threading it through every function signature.
 */
import { AsyncLocalStorage } from 'node:async_hooks'

const BRAND: unique symbol = Symbol('CorrelationId')

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

const STORAGE = new AsyncLocalStorage<CorrelationId>()

/**
 * Run `fn` with `id` installed as the active correlation id. The id is
 * preserved across awaits inside `fn` (and any callees that schedule async
 * work) via `AsyncLocalStorage`. Returns whatever `fn` returns; rethrows
 * any error `fn` raises unchanged.
 */
export function withCorrelationId<T>(id: CorrelationId, fn: () => T): T {
  return STORAGE.run(id, fn)
}

/**
 * Return the currently-active correlation id, or `undefined` outside any
 * `withCorrelationId(...)` scope.
 */
export function currentCorrelationId(): CorrelationId | undefined {
  return STORAGE.getStore()
}
