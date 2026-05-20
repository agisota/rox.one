# Integration Test Doubles (PZD-80)

Reusable mocks for Electron's `WebContentsView` and `BrowserWindow` so every
integration can be unit-tested without spawning Electron. This module is the
foundation for testing future integrations (T271 artifacts, Browser-as-tool,
etc.) and closes the ~0% coverage gap on `RoxDesignViewManager` core logic.

## When to use these mocks

- You are writing a **unit test** for a class that manages an Electron view
  (`RoxDesignViewManager`, future `BrowserToolViewManager`, T271 artifact
  preview surface, etc.).
- You need to drive a navigation lifecycle (`did-finish-load`, `dom-ready`,
  `did-start-navigation`, `will-navigate`, `render-process-gone`) without a
  real renderer process.
- You need to assert that **listeners are not leaked** across destroy.

Do **not** use these mocks for:

- End-to-end smoke tests that need a real renderer (`bun run electron:smoke`).
- React component tests — keep using `happy-dom` + `@testing-library/react`.

## Quickstart: WebContentsView integration

```ts
import { afterEach, describe, expect, it } from 'bun:test'
import { MockWebContentsView, disposeMocks } from '../integrations/__testing__'

describe('MyIntegrationViewManager', () => {
  const views: MockWebContentsView[] = []
  afterEach(() => disposeMocks(...views))

  it('applies CSS skin after did-finish-load', async () => {
    const view = new MockWebContentsView()
    views.push(view)

    // Wire the production code against the mock here, then drive a lifecycle:
    view.emit('did-finish-load')

    // Assert the production code asked the view to inject CSS:
    expect(Object.keys(view.getInsertedCss()).length).toBeGreaterThan(0)
  })
})
```

## Quickstart: In-process integration (no view)

In-process integrations (those without a `WebContentsView`) generally don't
need this module. Use it only when you want a uniform manifest shape:

```ts
import { mockManifest } from '../integrations/__testing__'

const manifest = mockManifest({ id: 'my-tool', kind: 'in-process' })
```

## Listener-leak detection pattern

Every mock tracks its listener counts. The canonical assertion in `afterEach`:

```ts
afterEach(() => {
  expect(view.getListenerCounts()).toEqual({})
})
```

This catches the most common Electron bug: registering `on('did-finish-load')`
without a matching `off(...)` on destroy. If your production code uses
`webContents.removeAllListeners('event')`, the counts should drop to zero
once destroy runs.

## Cookbook

### Simulate a load failure

```ts
const view = new MockWebContentsView()
view.setLoadURLImplementation(async () => {
  throw new Error('ERR_CONNECTION_REFUSED')
})
await expect(view.webContents.loadURL('http://offline.t')).rejects.toThrow()
```

### Drive a navigation lifecycle

```ts
view.emit('did-start-navigation', 'https://app.t/new')
view.emit('dom-ready')
view.emit('did-finish-load')
```

### Simulate a renderer crash

```ts
view.emit('render-process-gone', { reason: 'crashed' })
```

### Capture a window-open handler

```ts
view.webContents.setWindowOpenHandler(handler) // production code wires this
const result = view.invokeWindowOpenHandler({ url: 'https://example.com' })
expect(result.action).toBe('deny')
```

### Configure executeJavaScript return value

```ts
view.setExecuteJavaScriptReturn(true) // every call resolves to `true`
// or, for per-call behaviour:
view.setExecuteJavaScriptImplementation(async (code) =>
  code.includes('isReady') ? true : undefined,
)
```

### Assert IPC payloads

Production code that dispatches IPC messages through the mock's `webContents`
send method (e.g. `view.webContents['send']('rox:status', { ready: true })`)
records every call. Assert on the captured payloads via `getSentMessages()`:

```ts
expect(view.getSentMessages()).toEqual([
  { channel: 'rox:status', args: [{ ready: true }] },
])
```

## Wiring into existing tests

Tests today `mock.module('electron', () => ({...}))` ad-hoc, which means each
file reinvents a partial mock. Migrate them by importing the shared mocks:

```ts
import { mock } from 'bun:test'
import { MockBrowserView, MockBrowserWindow, MockWebContentsView } from '...'

mock.module('electron', () => ({
  BrowserView: MockBrowserView,
  BrowserWindow: MockBrowserWindow,
  WebContentsView: MockWebContentsView,
  shell: { openExternal: mock(async () => undefined) },
}))
```

(`MockBrowserView` is not provided in this PZD-80 deliverable; build it the
same way as `MockBrowserWindow` when the first BrowserView-using integration
arrives.)

## Notes

- The `IntegrationManifest` type is stubbed locally in `factories.ts` until
  PZD-78 lands the canonical `@rox-one/shared/integrations/manifest` module.
  When PZD-78 merges, swap the local interface for the canonical import; tests
  using `mockManifest()` will keep working unchanged.
- All mocks are synchronous and deterministic — opt into latency or failure
  per test via `setLoadURLImplementation` etc.
- Tests must call `disposeMocks(...)` (or `view.webContents.close()`) in
  `afterEach` so the listener-count assertion is meaningful.
