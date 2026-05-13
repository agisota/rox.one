import { afterEach, describe, expect, it } from 'bun:test'
import { setDismissibleLayerBridge } from '../../lib/dismissible-layer-bridge'
import { getKeybindingContext } from '../keybinding-context'

const originalDocument = globalThis.document

function setTestDocument(querySelector: (selector: string) => object | null): void {
  const head = { appendChild: () => undefined }
  ;(globalThis as unknown as { document: Document }).document = {
    querySelector,
    head,
    getElementsByTagName: (tagName: string) => (tagName === 'head' ? [head] : []),
    createElement: () => ({
      appendChild: () => undefined,
      styleSheet: null,
      type: '',
    }),
    createTextNode: () => ({}),
  } as unknown as Document
}

afterEach(() => {
  setDismissibleLayerBridge(null)
  ;(globalThis as unknown as { document: Document | undefined }).document = originalDocument
})

describe('getKeybindingContext', () => {
  it('sets menuOpen=true when dismissible stack has open layers', () => {
    setDismissibleLayerBridge({
      registerLayer: () => () => {},
      hasOpenLayers: () => true,
      getTopLayer: () => ({ id: 'island-1', type: 'island', priority: 200 }),
      closeTop: () => true,
      handleEscape: () => true,
    })

    setTestDocument(() => null)

    const event = {
      target: { tagName: 'DIV', isContentEditable: false },
    } as unknown as KeyboardEvent

    const context = getKeybindingContext(event)
    expect(context.menuOpen).toBe(true)
  })

  it('sets menuOpen=true when island dialog overlay is open', () => {
    setTestDocument((selector: string) => {
      if (selector.includes('[data-ca-island-dialog="true"][data-state="open"]')) {
        return {}
      }

      return null
    })

    const event = {
      target: { tagName: 'DIV', isContentEditable: false },
    } as unknown as KeyboardEvent

    const context = getKeybindingContext(event)
    expect(context.menuOpen).toBe(true)
  })

  it('sets menuOpen=false when no overlay is open', () => {
    setTestDocument(() => null)

    const event = {
      target: { tagName: 'DIV', isContentEditable: false },
    } as unknown as KeyboardEvent

    const context = getKeybindingContext(event)
    expect(context.menuOpen).toBe(false)
  })
})
