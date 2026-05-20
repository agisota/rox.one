/**
 * Integration-style test for the perf phase hook wiring inside
 * RoxDesignViewManager. We don't load Electron here; instead we drive a
 * minimal stub through the manager and assert the hook receives the expected
 * sequence of `startPhase()` calls.
 */
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'

mock.module('electron', () => {
  class FakeWebContents {
    id = 1
    private listeners = new Map<string, Array<(...args: unknown[]) => void>>()
    on(event: string, handler: (...args: unknown[]) => void) {
      const arr = this.listeners.get(event) ?? []
      arr.push(handler)
      this.listeners.set(event, arr)
      return this
    }
    emit(event: string, ...args: unknown[]) {
      for (const h of this.listeners.get(event) ?? []) h(...args)
    }
    isDestroyed() { return false }
    async loadURL(_url: string) { /* no-op */ }
    setBackgroundColor(_color: string) { /* no-op */ }
    setZoomFactor(_value: number) { /* no-op */ }
    async insertCSS(_css: string) { return 'css-key' }
    async executeJavaScript(_src: string) { return undefined }
    setWindowOpenHandler(_handler: unknown) { /* no-op */ }
    close() { /* no-op */ }
  }

  class FakeWebContentsView {
    public webContents = new FakeWebContents()
    constructor(_opts?: unknown) {}
    setBounds(_b: unknown) {}
    setVisible(_v: boolean) {}
    setBackgroundColor(_c: string) {}
  }

  class FakeBrowserView extends FakeWebContentsView {}

  class FakeBrowserWindow {
    public webContents = new FakeWebContents()
    public contentView = {
      addChildView(_child: unknown) {},
    }
    once(_event: string, _handler: unknown) { return this }
    isDestroyed() { return false }
    addBrowserView(_v: unknown) {}
    removeBrowserView(_v: unknown) {}
    setTopBrowserView(_v: unknown) {}
  }

  return {
    WebContentsView: FakeWebContentsView,
    BrowserView: FakeBrowserView,
    BrowserWindow: FakeBrowserWindow,
    shell: { openExternal: async () => undefined },
  }
})

mock.module('../rox-design-theme-bridge', () => ({
  startDesignThemeBridge: () => () => undefined,
}))

const { RoxDesignViewManager } = await import('../rox-design-view-manager') as typeof import('../rox-design-view-manager')

interface PhaseCall {
  phase: string
  endedAt: number
}

function createPhaseHookHarness() {
  let now = 0
  const advance = (ms: number) => { now += ms }
  const calls: PhaseCall[] = []
  const completes: number[] = []
  const factory = () => ({
    startPhase: (phase: 'attach-view' | 'load-url' | 'dom-ready' | 'did-finish-load') => {
      return {
        end: () => calls.push({ phase, endedAt: now }),
      }
    },
    complete: () => {
      completes.push(now)
    },
  })
  return { factory, calls, completes, advance, getNow: () => now }
}

const HOST_ID = 7

function createWindowManagerStub(window: import('electron').BrowserWindow) {
  return {
    getWindowByWebContentsId: (id: number) => (id === HOST_ID ? window : null),
  } as unknown as import('../window-manager').WindowManager
}

describe('RoxDesignViewManager perf phase hook', () => {
  let factory: ReturnType<typeof createPhaseHookHarness>['factory']
  let calls: PhaseCall[]
  let completes: number[]
  let advance: (ms: number) => void

  beforeEach(() => {
    const harness = createPhaseHookHarness()
    factory = harness.factory
    calls = harness.calls
    completes = harness.completes
    advance = harness.advance
  })

  afterEach(() => {
    calls.length = 0
    completes.length = 0
  })

  test('happy-path show triggers attach-view, load-url, dom-ready, did-finish-load in order', async () => {
    const { BrowserWindow } = await import('electron')
    const window = new (BrowserWindow as unknown as new () => import('electron').BrowserWindow)()
    Object.defineProperty(window.webContents, 'id', { value: HOST_ID, writable: true })

    const manager = new RoxDesignViewManager({
      windowManager: createWindowManagerStub(window),
      showPhaseHookFactory: factory,
    })

    const showPromise = manager.show({
      senderWebContentsId: HOST_ID,
      url: 'https://design.t/app',
      bounds: { x: 0, y: 0, width: 800, height: 600 },
    })
    advance(50)
    const result = await showPromise

    expect(result.status).toBe('shown')

    // After show() resolves: attach-view + load-url ended; dom-ready and
    // did-finish-load still pending.
    const phasesBeforeEvents = calls.map((c) => c.phase)
    expect(phasesBeforeEvents).toEqual(['attach-view', 'load-url'])

    // Simulate dom-ready then did-finish-load events on the embedded view.
    const entry = (manager as unknown as { entries: Map<number, { webContents: { emit: (e: string) => void } }> }).entries.get(HOST_ID)
    expect(entry).toBeDefined()
    advance(30)
    entry!.webContents.emit('dom-ready')
    advance(45)
    entry!.webContents.emit('did-finish-load')

    const phaseSequence = calls.map((c) => c.phase)
    expect(phaseSequence).toEqual(['attach-view', 'load-url', 'dom-ready', 'did-finish-load'])

    // complete() must fire exactly once after did-finish-load so the show
    // span (cold-start / warm-open total) is emitted to the telemetry sink.
    expect(completes).toHaveLength(1)
  })

  test('manager without phase hook factory does not throw', async () => {
    const { BrowserWindow } = await import('electron')
    const window = new (BrowserWindow as unknown as new () => import('electron').BrowserWindow)()
    Object.defineProperty(window.webContents, 'id', { value: HOST_ID, writable: true })

    const manager = new RoxDesignViewManager({
      windowManager: createWindowManagerStub(window),
    })

    await expect(manager.show({
      senderWebContentsId: HOST_ID,
      url: 'https://design.t/app',
      bounds: { x: 0, y: 0, width: 800, height: 600 },
    })).resolves.toMatchObject({ status: 'shown' })
  })

  test('did-fail-load releases pending dom-ready/finish-load phase hooks', async () => {
    const { BrowserWindow } = await import('electron')
    const window = new (BrowserWindow as unknown as new () => import('electron').BrowserWindow)()
    Object.defineProperty(window.webContents, 'id', { value: HOST_ID, writable: true })

    const manager = new RoxDesignViewManager({
      windowManager: createWindowManagerStub(window),
      showPhaseHookFactory: factory,
    })

    await manager.show({
      senderWebContentsId: HOST_ID,
      url: 'https://design.t/app',
      bounds: { x: 0, y: 0, width: 800, height: 600 },
    })

    const entry = (manager as unknown as { entries: Map<number, { webContents: { emit: (e: string, ...a: unknown[]) => void } }> }).entries.get(HOST_ID)
    expect(entry).toBeDefined()
    entry!.webContents.emit('did-fail-load', undefined, -3, 'aborted', 'https://design.t/app')

    const phases = calls.map((c) => c.phase)
    expect(phases).toContain('dom-ready')
    expect(phases).toContain('did-finish-load')
    // did-fail-load must also close the show-level hook so we don't leak
    // open cold-start spans when the embed fails to load.
    expect(completes).toHaveLength(1)
  })
})
