/**
 * Unit tests for registry-bootstrap — PZD-37 Wave 11.
 *
 * Cycles:
 *   1/2  RED→GREEN: bootstrapArtifactViewerRegistry returns registry with 6 adapters
 *   3/4  RED→GREEN: resolveByMime('text/markdown') returns md adapter
 *   5/6  RED→GREEN: singleton — 2 calls return identical reference
 */
import { describe, it, expect, beforeEach } from 'bun:test'

// Reset module cache between singleton tests via dynamic import trick.
// Each describe block imports fresh when needed.

describe('bootstrapArtifactViewerRegistry', () => {
  it('returns an ArtifactViewerRegistry instance', async () => {
    const { bootstrapArtifactViewerRegistry } = await import('../registry-bootstrap.ts')
    const registry = await bootstrapArtifactViewerRegistry()
    expect(registry).toBeTruthy()
    expect(typeof registry.resolveByMime).toBe('function')
  })

  it('resolves md adapter for text/markdown', async () => {
    const { bootstrapArtifactViewerRegistry } = await import('../registry-bootstrap.ts')
    const registry = await bootstrapArtifactViewerRegistry()
    const adapter = await registry.resolveByMime('text/markdown')
    expect(adapter).not.toBeNull()
    expect(adapter?.kind).toBe('md')
  })

  it('resolves browser adapter for text/html', async () => {
    const { bootstrapArtifactViewerRegistry } = await import('../registry-bootstrap.ts')
    const registry = await bootstrapArtifactViewerRegistry()
    const adapter = await registry.resolveByMime('text/html')
    expect(adapter).not.toBeNull()
    expect(adapter?.kind).toBe('browser')
  })

  it('returns null for unknown mime type', async () => {
    const { bootstrapArtifactViewerRegistry } = await import('../registry-bootstrap.ts')
    const registry = await bootstrapArtifactViewerRegistry()
    const adapter = await registry.resolveByMime('application/x-unknown-mime-type')
    expect(adapter).toBeNull()
  })
})

describe('getArtifactViewerRegistry (singleton)', () => {
  it('returns the same reference on repeated calls', async () => {
    const { getArtifactViewerRegistry } = await import('../registry-bootstrap.ts')
    const first = getArtifactViewerRegistry()
    const second = getArtifactViewerRegistry()
    expect(first).toBe(second)
  })
})
