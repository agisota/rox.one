/**
 * Browser shim for `node:async_hooks`.
 *
 * The renderer never uses correlation-ID propagation — that's a
 * server / main-process concern (T246). This shim satisfies the
 * static import in `@rox-one/shared/observability/correlation.ts`
 * so the renderer bundle can tree-shake the real AsyncLocalStorage
 * out without a build error.
 *
 * NOTE: `AsyncLocalStorage.getStore()` always returns `undefined` in
 * the renderer. Correlation IDs emitted from renderer code will carry
 * whatever fallback the caller provides, not a propagated span ID.
 */

export class AsyncLocalStorage<T> {
  run<R>(_store: T, fn: () => R): R {
    return fn()
  }

  getStore(): T | undefined {
    return undefined
  }

  enterWith(_store: T): void {
    // no-op in browser context
  }

  exit<R>(fn: () => R): R {
    return fn()
  }
}

export class AsyncResource {
  constructor(_type: string) {}

  runInAsyncScope<R>(fn: () => R): R {
    return fn()
  }
}

export function createHook(_hooks: object): { enable(): void; disable(): void } {
  return { enable() {}, disable() {} }
}

export function executionAsyncId(): number {
  return 0
}

export function triggerAsyncId(): number {
  return 0
}
