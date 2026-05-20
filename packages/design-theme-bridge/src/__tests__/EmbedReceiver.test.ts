import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test'
import { EmbedReceiver } from '../EmbedReceiver'

// --- Cycle 2: apply(snapshot) sets documentElement.style.setProperty ---

describe('EmbedReceiver.apply()', () => {
  let setPropertyMock: ReturnType<typeof mock>
  let origDocument: typeof globalThis.document

  beforeEach(() => {
    origDocument = globalThis.document
    setPropertyMock = mock((_name: string, _value: string) => {})
    ;(globalThis as Record<string, unknown>).document = {
      documentElement: {
        style: {
          setProperty: setPropertyMock,
        },
      },
    }
  })

  afterEach(() => {
    ;(globalThis as Record<string, unknown>).document = origDocument
  })

  it('calls setProperty for each entry in the snapshot', () => {
    const receiver = new EmbedReceiver()
    const snapshot = {
      '--rox-accent': '#22d3ee',
      '--rox-bg': '#05070d',
      '--rox-text': '#d8dee9',
    }

    receiver.apply(snapshot)

    expect(setPropertyMock).toHaveBeenCalledTimes(3)
    expect(setPropertyMock).toHaveBeenCalledWith('--rox-accent', '#22d3ee')
    expect(setPropertyMock).toHaveBeenCalledWith('--rox-bg', '#05070d')
    expect(setPropertyMock).toHaveBeenCalledWith('--rox-text', '#d8dee9')
  })

  it('handles empty snapshot without errors', () => {
    const receiver = new EmbedReceiver()
    expect(() => receiver.apply({})).not.toThrow()
    expect(setPropertyMock).toHaveBeenCalledTimes(0)
  })

  it('applies all entries including multi-value properties', () => {
    const receiver = new EmbedReceiver()
    const snapshot = {
      '--rox-shadow': '0 1px 0 rgba(255,255,255,0.04) inset, 0 14px 32px rgba(0,0,0,0.22)',
      '--rox-radius': '14px',
    }

    receiver.apply(snapshot)

    expect(setPropertyMock).toHaveBeenCalledWith('--rox-shadow', '0 1px 0 rgba(255,255,255,0.04) inset, 0 14px 32px rgba(0,0,0,0.22)')
    expect(setPropertyMock).toHaveBeenCalledWith('--rox-radius', '14px')
  })
})

// --- Cycle 5: postMessage origin filter rejects msgs from non-Design webContents ---

describe('EmbedReceiver origin filter', () => {
  it('accepts messages from the managed webContents id', () => {
    const setPropertyMock = mock((_name: string, _value: string) => {})
    ;(globalThis as Record<string, unknown>).document = {
      documentElement: { style: { setProperty: setPropertyMock } },
    }

    const receiver = new EmbedReceiver({ managedWebContentsId: 42 })
    const snapshot = { '--rox-accent': '#22d3ee' }

    const accepted = receiver.handleMessage(
      { senderId: 42 },
      { type: 'rox-design:theme-snapshot', snapshot },
    )

    expect(accepted).toBe(true)
    expect(setPropertyMock).toHaveBeenCalledWith('--rox-accent', '#22d3ee')
  })

  it('rejects messages from a different webContents id', () => {
    const setPropertyMock = mock((_name: string, _value: string) => {})
    ;(globalThis as Record<string, unknown>).document = {
      documentElement: { style: { setProperty: setPropertyMock } },
    }

    const receiver = new EmbedReceiver({ managedWebContentsId: 42 })
    const snapshot = { '--rox-accent': '#22d3ee' }

    const accepted = receiver.handleMessage(
      { senderId: 99 },
      { type: 'rox-design:theme-snapshot', snapshot },
    )

    expect(accepted).toBe(false)
    expect(setPropertyMock).not.toHaveBeenCalled()
  })

  it('rejects messages with wrong type even from correct sender', () => {
    const setPropertyMock = mock((_name: string, _value: string) => {})
    ;(globalThis as Record<string, unknown>).document = {
      documentElement: { style: { setProperty: setPropertyMock } },
    }

    const receiver = new EmbedReceiver({ managedWebContentsId: 42 })

    const accepted = receiver.handleMessage(
      { senderId: 42 },
      { type: 'some-other-type', snapshot: {} },
    )

    expect(accepted).toBe(false)
    expect(setPropertyMock).not.toHaveBeenCalled()
  })

  it('accepts messages when no managedWebContentsId is set (permissive mode)', () => {
    const setPropertyMock = mock((_name: string, _value: string) => {})
    ;(globalThis as Record<string, unknown>).document = {
      documentElement: { style: { setProperty: setPropertyMock } },
    }

    const receiver = new EmbedReceiver()
    const snapshot = { '--rox-accent': '#22d3ee' }

    const accepted = receiver.handleMessage(
      { senderId: 999 },
      { type: 'rox-design:theme-snapshot', snapshot },
    )

    expect(accepted).toBe(true)
    expect(setPropertyMock).toHaveBeenCalledWith('--rox-accent', '#22d3ee')
  })
})
