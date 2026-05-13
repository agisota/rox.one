import { afterEach, describe, expect, it } from 'bun:test'
import { setDismissibleLayerBridge } from '../dismissible-layer-bridge'
import { hasOpenOverlay } from '../overlay-detection'

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

describe('hasOpenOverlay', () => {
  it('returns true when dismissible stack has open layers', () => {
    setDismissibleLayerBridge({
      registerLayer: () => () => {},
      hasOpenLayers: () => true,
      getTopLayer: () => ({ id: 'island-1', type: 'island', priority: 200 }),
      closeTop: () => true,
      handleEscape: () => true,
    })

    setTestDocument(() => null)

    expect(hasOpenOverlay()).toBe(true)
  })

  it('returns true when an island dialog is open', () => {
    setTestDocument((selector: string) => {
      if (selector.includes('[data-ca-island-dialog="true"][data-state="open"]')) {
        return {}
      }

      return null
    })

    expect(hasOpenOverlay()).toBe(true)
  })

  it('returns false when no overlays are open', () => {
    setTestDocument(() => null)

    expect(hasOpenOverlay()).toBe(false)
  })
})
