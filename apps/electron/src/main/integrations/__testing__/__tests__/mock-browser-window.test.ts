/**
 * PZD-80: Tests for MockBrowserWindow used to host MockWebContentsView in unit tests.
 */
import { afterEach, describe, expect, it, mock } from 'bun:test'

import { MockBrowserWindow } from '../mock-browser-window'
import { MockWebContentsView } from '../mock-web-contents-view'

describe('MockBrowserWindow', () => {
  let window: MockBrowserWindow

  afterEach(() => {
    if (window && !window.isDestroyed()) window.close()
  })

  it('exposes a webContents.id distinct from any contained child view', () => {
    window = new MockBrowserWindow()
    const child = new MockWebContentsView()
    expect(window.webContents.id).not.toBe(child.webContents.id)
    child.webContents.close()
  })

  it('supports contentView.addChildView and removeChildView with attached child tracking', () => {
    window = new MockBrowserWindow()
    const child = new MockWebContentsView()
    expect(window.getChildViews()).toEqual([])
    window.contentView.addChildView(child)
    expect(window.getChildViews()).toContain(child)
    window.contentView.removeChildView(child)
    expect(window.getChildViews()).not.toContain(child)
    child.webContents.close()
  })

  it('flips isDestroyed() after close() and fires the closed listener exactly once', () => {
    window = new MockBrowserWindow()
    const closed = mock(() => undefined)
    window.on('closed', closed)
    window.close()
    window.close() // no-op
    expect(window.isDestroyed()).toBe(true)
    expect(closed).toHaveBeenCalledTimes(1)
  })

  it('getBounds() returns the most recent setBounds value', () => {
    window = new MockBrowserWindow()
    window.setBounds({ x: 0, y: 0, width: 1280, height: 800 })
    expect(window.getBounds()).toEqual({ x: 0, y: 0, width: 1280, height: 800 })
    window.setBounds({ x: 10, y: 20, width: 640, height: 480 })
    expect(window.getBounds()).toEqual({ x: 10, y: 20, width: 640, height: 480 })
  })

  it('tracks listener counts on closed events for leak detection', () => {
    window = new MockBrowserWindow()
    const a = mock(() => undefined)
    const b = mock(() => undefined)
    window.on('closed', a)
    window.on('closed', b)
    window.off('closed', a)
    expect(window.getListenerCounts()['closed']).toBe(1)
  })
})
