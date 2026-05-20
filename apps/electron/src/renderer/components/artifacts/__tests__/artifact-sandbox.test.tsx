import { describe, expect, it } from 'bun:test'
import { buildArtifactSandboxSrcDoc, getArtifactIframeSandbox } from '../artifact-sandbox'

describe('artifact sandbox policy', () => {
  it('allows scripts for interactive HTML without granting same-origin or navigation powers', () => {
    expect(getArtifactIframeSandbox({ interactive: true })).toBe('allow-scripts')
  })

  it('keeps noninteractive HTML fully sandboxed', () => {
    expect(getArtifactIframeSandbox({ interactive: false })).toBe('')
  })

  it('injects a restrictive CSP and strips script execution unless interactive is enabled', () => {
    const srcDoc = buildArtifactSandboxSrcDoc('<h1>Demo</h1><script>window.parent.postMessage("x","*")</script>', {
      interactive: false,
      title: 'Demo',
    })

    expect(srcDoc).toContain("default-src 'none'")
    expect(srcDoc).toContain("object-src 'none'")
    expect(srcDoc).toContain("base-uri 'none'")
    expect(srcDoc).toContain("form-action 'none'")
    expect(srcDoc).not.toContain('<script>window.parent.postMessage')
    expect(srcDoc).toContain('<h1>Demo</h1>')
  })
})
