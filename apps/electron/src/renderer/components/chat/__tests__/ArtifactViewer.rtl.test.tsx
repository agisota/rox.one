/**
 * RTL tests for ArtifactViewer — PZD-37 Wave 11.
 *
 * Cycles:
 *   7/8   RED→GREEN: renders fallback card when no adapter matches mime
 *   9/10  RED→GREEN: resolves md adapter for text/markdown attachment
 *   11/12 RED→GREEN: resolves browser adapter for text/html attachment
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import * as React from 'react'
import type { ArtifactViewerRegistry } from '@rox-one/artifact-viewer-core'
import type { ReactNode } from 'react'

// ── Stub adapters (inline — avoid vi.mock dynamic import resolution issues) ───
function makeStubAdapter(kind: string, mimes: string[]) {
  return {
    kind,
    canRender: (mime: string) => mimes.includes(mime),
    render: (_uri: string): ReactNode =>
      React.createElement('div', { 'data-artifact-viewer': kind }),
  }
}

const mdAdapter = makeStubAdapter('md', ['text/markdown', 'text/x-markdown'])
const browserAdapter = makeStubAdapter('browser', ['text/html', 'application/xhtml+xml'])

// Build a minimal registry using the real ArtifactViewerRegistry class with
// stub adapters pre-loaded (no lazy factory overhead in tests).
let mockRegistry: ArtifactViewerRegistry

vi.mock('../../../artifact-viewers/registry-bootstrap', async () => {
  const { ArtifactViewerRegistry } = await import('@rox-one/artifact-viewer-core')
  const registry = new ArtifactViewerRegistry()
  registry.register(async () => mdAdapter)
  registry.register(async () => browserAdapter)
  mockRegistry = registry
  return {
    getArtifactViewerRegistry: () => registry,
    bootstrapArtifactViewerRegistry: async () => registry,
  }
})

// Import AFTER the mock is hoisted
const { ArtifactViewer } = await import('../ArtifactViewer')

// ── electronAPI stub ─────────────────────────────────────────────────────────
beforeEach(() => {
  Object.assign(window, {
    electronAPI: {
      openUrl: vi.fn(),
      openWithContext: vi.fn().mockResolvedValue({ status: 'opened', windowId: 1 }),
    },
  })
})

afterEach(() => {
  cleanup()
})

// ── Fixtures ─────────────────────────────────────────────────────────────────
function makeAttachment(mime: string, uri = `data:${mime},`) {
  return { mime, uri }
}

// ── Cycle 7/8: fallback card for unknown mime ────────────────────────────────
describe('ArtifactViewer · fallback (no adapter)', () => {
  it('renders the fallback card when mime has no registered adapter', async () => {
    render(
      <ArtifactViewer
        artifact={makeAttachment('application/x-unknown-type')}
      />,
    )
    await waitFor(() => {
      expect(screen.getByTestId('artifact-viewer-fallback')).toBeTruthy()
    })
  })

  it('fallback card shows the mime type in text', async () => {
    render(
      <ArtifactViewer
        artifact={makeAttachment('application/x-unknown-type')}
      />,
    )
    await waitFor(() => {
      expect(screen.getByTestId('artifact-viewer-fallback').textContent).toContain(
        'application/x-unknown-type',
      )
    })
  })
})

// ── Cycle 9/10: md adapter for text/markdown ─────────────────────────────────
describe('ArtifactViewer · md adapter', () => {
  it('renders md adapter output for text/markdown', async () => {
    render(
      <ArtifactViewer
        artifact={makeAttachment('text/markdown')}
      />,
    )
    await waitFor(() => {
      const sandbox = screen.getByTestId('artifact-viewer-sandbox')
      expect(sandbox).toBeTruthy()
      expect(sandbox.querySelector('[data-artifact-viewer="md"]')).toBeTruthy()
    })
  })
})

// ── Cycle 11/12: browser adapter for text/html ───────────────────────────────
describe('ArtifactViewer · browser adapter', () => {
  it('renders browser adapter output for text/html', async () => {
    render(
      <ArtifactViewer
        artifact={makeAttachment('text/html')}
      />,
    )
    await waitFor(() => {
      const sandbox = screen.getByTestId('artifact-viewer-sandbox')
      expect(sandbox).toBeTruthy()
      expect(sandbox.querySelector('[data-artifact-viewer="browser"]')).toBeTruthy()
    })
  })
})
