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

import { type CorrelationId } from './correlation-id.ts'

export { asCorrelationId, type CorrelationId } from './correlation-id.ts'

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
