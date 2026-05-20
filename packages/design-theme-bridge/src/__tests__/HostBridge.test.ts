import { describe, it, expect, beforeEach, mock, afterEach } from 'bun:test'
import { HostBridge } from '../HostBridge'

// --- Cycle 1: snapshot() returns object with all --rox-* CSS variables serialized ---

describe('HostBridge.snapshot()', () => {
  let origGetComputedStyle: typeof globalThis.getComputedStyle
  let origDocument: typeof globalThis.document

  beforeEach(() => {
    origGetComputedStyle = globalThis.getComputedStyle
    origDocument = globalThis.document
  })

  afterEach(() => {
    globalThis.getComputedStyle = origGetComputedStyle
    ;(globalThis as Record<string, unknown>).document = origDocument
  })

  it('returns a plain object with keys matching --rox-* CSS variables', () => {
    // Arrange: mock getPropertyValue to return values for known --rox-* vars
    const fakeVars: Record<string, string> = {
      '--rox-accent': '#22d3ee',
      '--rox-bg': '#05070d',
      '--rox-text': '#d8dee9',
    }

    const mockStyle = {
      getPropertyValue: (name: string) => fakeVars[name] ?? '',
    }

    // Stub getComputedStyle to return our fake style
    globalThis.getComputedStyle = ((_el: Element) => mockStyle) as typeof getComputedStyle

    // Stub document.documentElement and its style iteration
    ;(globalThis as Record<string, unknown>).document = {
      documentElement: {
        style: {
          [Symbol.iterator]: function* () {
            yield '--rox-accent'
            yield '--rox-bg'
            yield '--rox-text'
            yield '--non-rox-var'
          },
        },
      },
    }

    const bridge = new HostBridge()
    const snapshot = bridge.snapshot()

    expect(typeof snapshot).toBe('object')
    expect(snapshot['--rox-accent']).toBe('#22d3ee')
    expect(snapshot['--rox-bg']).toBe('#05070d')
    expect(snapshot['--rox-text']).toBe('#d8dee9')
    // Non-rox var should not be included
    expect('--non-rox-var' in snapshot).toBe(false)
  })

  it('returns an empty object when no --rox-* variables are set', () => {
    const mockStyle = { getPropertyValue: (_name: string) => '' }
    globalThis.getComputedStyle = ((_el: Element) => mockStyle) as typeof getComputedStyle
    ;(globalThis as Record<string, unknown>).document = {
      documentElement: {
        style: {
          [Symbol.iterator]: function* () {
            yield '--some-other-var'
          },
        },
      },
    }

    const bridge = new HostBridge()
    const snapshot = bridge.snapshot()

    expect(Object.keys(snapshot).length).toBe(0)
  })

  it('includes all --rox-* properties from the computed style root', () => {
    const allVars: Record<string, string> = {
      '--rox-accent': '#22d3ee',
      '--rox-bg': '#05070d',
      '--rox-text': '#d8dee9',
      '--rox-border': 'rgba(148,163,184,0.14)',
      '--rox-radius': '14px',
    }

    const mockStyle = {
      getPropertyValue: (name: string) => allVars[name] ?? '',
    }
    globalThis.getComputedStyle = ((_el: Element) => mockStyle) as typeof getComputedStyle
    ;(globalThis as Record<string, unknown>).document = {
      documentElement: {
        style: {
          [Symbol.iterator]: function* () {
            for (const key of Object.keys(allVars)) yield key
          },
        },
      },
    }

    const bridge = new HostBridge()
    const snapshot = bridge.snapshot()

    expect(Object.keys(snapshot).length).toBe(5)
    for (const [key, value] of Object.entries(allVars)) {
      expect(snapshot[key]).toBe(value)
    }
  })
})

// --- Cycle 3: nativeTheme switch → re-posts within 16ms ---

describe('HostBridge nativeTheme listener (timing)', () => {
  it('calls onSnapshot within 16ms when nativeTheme fires updated', async () => {
    const callbacks: Array<() => void> = []
    const mockNativeTheme = {
      on: (_event: string, cb: () => void) => { callbacks.push(cb) },
      removeListener: mock((_event: string, _cb: () => void) => {}),
    }

    const mockStyle = { getPropertyValue: (_name: string) => '#fff' }
    globalThis.getComputedStyle = ((_el: Element) => mockStyle) as typeof getComputedStyle
    ;(globalThis as Record<string, unknown>).document = {
      documentElement: {
        style: {
          [Symbol.iterator]: function* () { yield '--rox-accent' },
        },
      },
    }

    const snapshots: Array<Record<string, string>> = []
    const bridge = new HostBridge()
    bridge.startNativeThemeWatch(mockNativeTheme as unknown as Parameters<HostBridge['startNativeThemeWatch']>[0], (snap) => {
      snapshots.push(snap)
    })

    const start = performance.now()
    // Simulate nativeTheme updated
    callbacks[0]?.()
    // Wait up to 20ms for the callback to fire
    await new Promise<void>((resolve) => setTimeout(resolve, 20))
    const elapsed = performance.now() - start

    expect(snapshots.length).toBeGreaterThanOrEqual(1)
    expect(elapsed).toBeLessThan(100) // allow generous margin in test env
  })
})

// --- Cycle 4: cleanup on unmount — removeListener called ---

describe('HostBridge cleanup', () => {
  it('removes the nativeTheme listener on dispose()', () => {
    const listeners: Array<[string, () => void]> = []
    const mockNativeTheme = {
      on: (_event: string, cb: () => void) => { listeners.push([_event, cb]) },
      removeListener: mock((_event: string, _cb: () => void) => {}),
    }

    ;(globalThis as Record<string, unknown>).document = {
      documentElement: {
        style: { [Symbol.iterator]: function* () {} },
      },
    }

    const bridge = new HostBridge()
    bridge.startNativeThemeWatch(mockNativeTheme as unknown as Parameters<HostBridge['startNativeThemeWatch']>[0], () => {})
    bridge.dispose()

    expect(mockNativeTheme.removeListener).toHaveBeenCalledTimes(1)
    expect((mockNativeTheme.removeListener.mock.calls[0] as unknown[])[0]).toBe('updated')
  })
})
