/**
 * Unit tests for the ⌘⇧D / Ctrl+Shift+D hotkey handler in main/index.ts. [T537 PR#3]
 *
 * Cases covered:
 *   C9:  before-input-event with ⌘⇧D (mac) → emits design:toggle to webContents
 *   C9b: before-input-event with Ctrl+Shift+D (win/linux) → emits design:toggle
 *   C10: same hotkey while window is NOT focused → does NOT emit design:toggle
 *
 * Strategy: We test the `registerDesignHotkeyOnWebContents` helper function
 * exported from the hotkey module, which is the pure unit we can test in
 * isolation without booting the full Electron app.
 */

import { describe, expect, mock, test, beforeEach } from 'bun:test'

// ---------------------------------------------------------------------------
// Minimal Electron mock — must be registered before the module under test
// is imported. bun:test's mock.module() hoists it automatically.
// ---------------------------------------------------------------------------

const mockGetFocusedWindow = mock(() => null as null | object)

mock.module('electron', () => ({
  BrowserWindow: {
    getFocusedWindow: mockGetFocusedWindow,
    getAllWindows: () => [],
  },
  ipcMain: {
    handle: mock(() => {}),
    on: mock(() => {}),
  },
  app: {
    on: mock(() => {}),
    whenReady: mock(() => Promise.resolve()),
  },
}))

const { registerDesignHotkeyOnWebContents } = await import('../rox-design-hotkey') as typeof import('../rox-design-hotkey')

// ---------------------------------------------------------------------------
// Helper — build a minimal fake webContents with before-input-event support
// ---------------------------------------------------------------------------

interface FakeInputEvent {
  type: string
  key: string
  shift: boolean
  meta: boolean
  control: boolean
}

function makeFakeWebContents(focusedWin: object | null = null) {
  const listeners = new Map<string, Array<(event: object, input: FakeInputEvent) => void>>()
  const sendMock = mock((_channel: string) => undefined)

  const webContents = {
    id: 1,
    on: (event: string, listener: (event: object, input: FakeInputEvent) => void) => {
      if (!listeners.has(event)) listeners.set(event, [])
      listeners.get(event)!.push(listener)
    },
    send: sendMock,
  }

  // Helper to simulate an input event
  const simulateInput = (input: FakeInputEvent) => {
    for (const listener of listeners.get('before-input-event') ?? []) {
      listener({}, input)
    }
  }

  // Helper to set what getFocusedWindow returns
  const setFocused = (win: object | null) => {
    mockGetFocusedWindow.mockImplementation(() => win)
  }

  return { webContents, sendMock, simulateInput, setFocused }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('registerDesignHotkeyOnWebContents', () => {
  beforeEach(() => {
    mockGetFocusedWindow.mockReset()
    mockGetFocusedWindow.mockImplementation(() => null)
  })

  // C9: Mac hotkey ⌘⇧D triggers design:toggle when window is focused
  test('C9: ⌘⇧D emits design:toggle when window is focused (mac)', () => {
    const { webContents, sendMock, simulateInput, setFocused } = makeFakeWebContents()
    registerDesignHotkeyOnWebContents(webContents as any)

    // Set the window as focused
    const fakeWin = { webContents }
    setFocused(fakeWin)

    simulateInput({ type: 'keyDown', key: 'd', shift: true, meta: true, control: false })

    expect(sendMock).toHaveBeenCalledWith('design:toggle')
  })

  // C9b: Ctrl+Shift+D triggers design:toggle when window is focused (win/linux)
  test('C9b: Ctrl+Shift+D emits design:toggle when window is focused (win/linux)', () => {
    const { webContents, sendMock, simulateInput, setFocused } = makeFakeWebContents()
    registerDesignHotkeyOnWebContents(webContents as any)

    const fakeWin = { webContents }
    setFocused(fakeWin)

    simulateInput({ type: 'keyDown', key: 'd', shift: true, meta: false, control: true })

    expect(sendMock).toHaveBeenCalledWith('design:toggle')
  })

  // C10: hotkey while window is NOT focused does NOT emit
  test('C10: hotkey does not emit design:toggle when window is not focused', () => {
    const { webContents, sendMock, simulateInput } = makeFakeWebContents()
    registerDesignHotkeyOnWebContents(webContents as any)

    // getFocusedWindow returns null → window is not focused
    mockGetFocusedWindow.mockImplementation(() => null)

    simulateInput({ type: 'keyDown', key: 'd', shift: true, meta: true, control: false })

    expect(sendMock).not.toHaveBeenCalled()
  })

  // Edge: keyUp events should NOT trigger
  test('keyUp variant of ⌘⇧D does not trigger', () => {
    const { webContents, sendMock, simulateInput, setFocused } = makeFakeWebContents()
    registerDesignHotkeyOnWebContents(webContents as any)

    const fakeWin = { webContents }
    setFocused(fakeWin)

    simulateInput({ type: 'keyUp', key: 'd', shift: true, meta: true, control: false })

    expect(sendMock).not.toHaveBeenCalled()
  })

  // Edge: D without shift does not trigger
  test('⌘D without shift does not trigger', () => {
    const { webContents, sendMock, simulateInput, setFocused } = makeFakeWebContents()
    registerDesignHotkeyOnWebContents(webContents as any)

    const fakeWin = { webContents }
    setFocused(fakeWin)

    simulateInput({ type: 'keyDown', key: 'd', shift: false, meta: true, control: false })

    expect(sendMock).not.toHaveBeenCalled()
  })
})
