/**
 * PZD-80: Tests for the reusable WebContentsView mock used by integration unit tests.
 *
 * These tests describe HOW the mock is consumed: they were written BEFORE the mock
 * itself (TDD red-green-refactor). When the mock is in place, all assertions below
 * must pass without spawning Electron.
 */
import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'

import {
  MockWebContentsView,
  type MockWebContents,
} from '../mock-web-contents-view'
import {
  disposeMocks,
  mockManifest,
  mockWebContentsViewFor,
} from '../factories'

describe('MockWebContentsView', () => {
  let view: MockWebContentsView

  beforeEach(() => {
    view = new MockWebContentsView()
  })

  afterEach(() => {
    if (!view.webContents.isDestroyed()) view.webContents.close()
  })

  it('exposes a webContents surface with a unique numeric id', () => {
    const a = new MockWebContentsView()
    const b = new MockWebContentsView()
    expect(typeof a.webContents.id).toBe('number')
    expect(a.webContents.id).not.toBe(b.webContents.id)
    a.webContents.close()
    b.webContents.close()
  })

  it('defaults loadURL to a resolved promise that records the URL', async () => {
    await view.webContents.loadURL('https://design.t/app')
    expect(view.webContents.getURL()).toBe('https://design.t/app')
  })

  it('lets tests override loadURL with a rejection to simulate navigation failure', async () => {
    const boom = new Error('ERR_CONNECTION_REFUSED')
    view.setLoadURLImplementation(async () => {
      throw boom
    })
    await expect(view.webContents.loadURL('http://offline.t')).rejects.toBe(boom)
    expect(view.webContents.getURL()).toBe('')
  })

  it('lets tests override executeJavaScript with a configurable return value', async () => {
    view.setExecuteJavaScriptReturn(42)
    const result = await view.webContents.executeJavaScript('1 + 1', true)
    expect(result).toBe(42)
  })

  it('returns a deterministic key from insertCSS and removes it via removeInsertedCSS', async () => {
    const key = await view.webContents.insertCSS('body { color: red }')
    expect(typeof key).toBe('string')
    expect(view.getInsertedCss()).toEqual({ [key]: 'body { color: red }' })

    await view.webContents.removeInsertedCSS(key)
    expect(view.getInsertedCss()).toEqual({})
  })

  it('emits did-finish-load to listeners registered via on()', () => {
    const handler = mock(() => undefined)
    view.webContents.on('did-finish-load', handler)
    view.emit('did-finish-load')
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('passes event arguments through emit for did-start-navigation', () => {
    const handler = mock((_event: unknown, url: string) => url)
    view.webContents.on('did-start-navigation', handler)
    view.emit('did-start-navigation', 'https://design.t/route')
    expect(handler).toHaveBeenCalledTimes(1)
    const [, url] = handler.mock.calls[0] as [unknown, string]
    expect(url).toBe('https://design.t/route')
  })

  it('passes structured payloads through emit for render-process-gone', () => {
    const handler = mock((_event: unknown, details: { reason: string }) => details)
    view.webContents.on('render-process-gone', handler)
    view.emit('render-process-gone', { reason: 'crashed' })
    expect(handler).toHaveBeenCalledTimes(1)
    const [, details] = handler.mock.calls[0] as [unknown, { reason: string }]
    expect(details.reason).toBe('crashed')
  })

  it('supports console-message with the same arity as Electron (level, message, line, sourceId)', () => {
    const handler = mock(
      (
        _event: unknown,
        level: number,
        message: string,
        line: number,
        sourceId: string,
      ) => ({ level, message, line, sourceId }),
    )
    view.webContents.on('console-message', handler)
    view.emit('console-message', 1, 'hello', 12, 'inline.js')
    expect(handler).toHaveBeenCalledTimes(1)
    const [, level, message, line, sourceId] = handler.mock.calls[0] as [
      unknown,
      number,
      string,
      number,
      string,
    ]
    expect({ level, message, line, sourceId }).toEqual({
      level: 1,
      message: 'hello',
      line: 12,
      sourceId: 'inline.js',
    })
  })

  it('once() fires exactly one time for an event', () => {
    const handler = mock(() => undefined)
    view.webContents.once('dom-ready', handler)
    view.emit('dom-ready')
    view.emit('dom-ready')
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('off() removes a previously registered listener', () => {
    const handler = mock(() => undefined)
    view.webContents.on('did-finish-load', handler)
    view.webContents.off('did-finish-load', handler)
    view.emit('did-finish-load')
    expect(handler).not.toHaveBeenCalled()
  })

  it('removeAllListeners() drops every listener for the event', () => {
    const a = mock(() => undefined)
    const b = mock(() => undefined)
    view.webContents.on('will-navigate', a)
    view.webContents.on('will-navigate', b)
    view.webContents.removeAllListeners('will-navigate')
    view.emit('will-navigate', 'https://design.t/next')
    expect(a).not.toHaveBeenCalled()
    expect(b).not.toHaveBeenCalled()
  })

  it('flips isDestroyed() to true after close()', () => {
    expect(view.webContents.isDestroyed()).toBe(false)
    view.webContents.close()
    expect(view.webContents.isDestroyed()).toBe(true)
  })

  it('emits destroyed on close()', () => {
    const handler = mock(() => undefined)
    view.webContents.on('destroyed', handler)
    view.webContents.close()
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('closeDevTools/openDevTools are observable via spy methods', () => {
    expect(view.webContents.isDevToolsOpened()).toBe(false)
    view.webContents.openDevTools()
    expect(view.webContents.isDevToolsOpened()).toBe(true)
    view.webContents.closeDevTools()
    expect(view.webContents.isDevToolsOpened()).toBe(false)
  })

  it('send() records IPC payloads so tests can assert on them', () => {
    view.webContents.send('rox-design:status', { status: 'ready' })
    view.webContents.send('rox-design:status', { status: 'busy' })
    expect(view.getSentMessages()).toEqual([
      { channel: 'rox-design:status', args: [{ status: 'ready' }] },
      { channel: 'rox-design:status', args: [{ status: 'busy' }] },
    ])
  })

  it('setWindowOpenHandler captures the handler for later invocation', () => {
    const handler = mock(() => ({ action: 'deny' as const }))
    view.webContents.setWindowOpenHandler(handler)
    const result = view.invokeWindowOpenHandler({ url: 'https://example.com' })
    expect(handler).toHaveBeenCalledTimes(1)
    expect(result).toEqual({ action: 'deny' })
  })

  it('tracks listener counts so tests can detect leaks', () => {
    const a = mock(() => undefined)
    const b = mock(() => undefined)
    const c = mock(() => undefined)
    const d = mock(() => undefined)
    const e = mock(() => undefined)

    view.webContents.on('did-finish-load', a)
    view.webContents.on('did-finish-load', b)
    view.webContents.on('did-finish-load', c)
    view.webContents.on('did-finish-load', d)
    view.webContents.on('did-finish-load', e)

    view.webContents.off('did-finish-load', a)
    view.webContents.off('did-finish-load', b)
    view.webContents.off('did-finish-load', c)

    expect(view.getListenerCounts()['did-finish-load']).toBe(2)
  })

  it('aggregates listener counts across multiple event names', () => {
    view.webContents.on('did-finish-load', () => undefined)
    view.webContents.on('dom-ready', () => undefined)
    view.webContents.on('dom-ready', () => undefined)
    view.webContents.on('will-navigate', () => undefined)

    const counts = view.getListenerCounts()
    expect(counts['did-finish-load']).toBe(1)
    expect(counts['dom-ready']).toBe(2)
    expect(counts['will-navigate']).toBe(1)
  })

  it('refuses to emit after close() so tests catch use-after-destroy', () => {
    const handler = mock(() => undefined)
    view.webContents.on('did-finish-load', handler)
    view.webContents.close()
    view.emit('did-finish-load')
    expect(handler).not.toHaveBeenCalled()
  })

  it('exposes webContents via the standard MockWebContents alias', () => {
    const wc: MockWebContents = view.webContents
    expect(typeof wc.executeJavaScript).toBe('function')
  })
})

describe('factories', () => {
  it('mockManifest returns a valid manifest with sensible defaults', () => {
    const manifest = mockManifest()
    expect(manifest.id).toMatch(/^[a-z0-9-]+$/)
    expect(manifest.kind).toBe('webContentsView')
    expect(manifest.partition).toMatch(/^persist:/)
  })

  it('mockManifest applies user-supplied overrides', () => {
    const manifest = mockManifest({ id: 'test-integration', kind: 'in-process' })
    expect(manifest.id).toBe('test-integration')
    expect(manifest.kind).toBe('in-process')
  })

  it('mockWebContentsViewFor mirrors the security baseline applied by createSecureWebContentsView', () => {
    const mocked = mockWebContentsViewFor()
    expect(mocked.webPreferences.contextIsolation).toBe(true)
    expect(mocked.webPreferences.nodeIntegration).toBe(false)
    expect(mocked.webPreferences.sandbox).toBe(true)
    expect(mocked.webPreferences.webviewTag).toBe(false)
    expect(mocked.webPreferences.partition).toMatch(/^persist:/)
    mocked.webContents.close()
  })

  it('mockWebContentsViewFor respects the manifest partition', () => {
    const mocked = mockWebContentsViewFor({ partition: 'persist:my-test' })
    expect(mocked.webPreferences.partition).toBe('persist:my-test')
    mocked.webContents.close()
  })

  it('disposeMocks closes every passed view and is idempotent', () => {
    const a = new MockWebContentsView()
    const b = new MockWebContentsView()
    disposeMocks(a, b)
    expect(a.webContents.isDestroyed()).toBe(true)
    expect(b.webContents.isDestroyed()).toBe(true)
    // Calling again must not throw.
    disposeMocks(a, b)
    expect(a.webContents.isDestroyed()).toBe(true)
  })
})
