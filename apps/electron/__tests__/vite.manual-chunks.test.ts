import { describe, expect, it, spyOn } from 'bun:test'
import * as manualChunks from '../vite.manual-chunks'

describe('getElectronRendererManualChunk', () => {
  it('returns correct chunk for node_modules ids', () => {
    expect(manualChunks.getElectronRendererManualChunk('/project/node_modules/sonner/dist/index.js')).toBe('sonner')
    expect(manualChunks.getElectronRendererManualChunk('/project/node_modules/@sentry/browser/dist/index.js')).toBe('sentry')
    expect(manualChunks.getElectronRendererManualChunk('/project/node_modules/react/index.js')).toBe('index-react')
    expect(manualChunks.getElectronRendererManualChunk('/project/node_modules/jotai/dist/index.js')).toBe('index-jotai')
    expect(manualChunks.getElectronRendererManualChunk('/project/src/renderer/foo.ts')).toBeUndefined()
  })

  it('normalizes the id exactly once — no double-normalization on already-normalized ids', () => {
    // Already-normalized id (forward slashes only) — spy on String.prototype.replace
    // to count how many times the backslash->slash replace pattern fires.
    const replaceCalls: Array<[unknown, unknown]> = []
    const originalReplace = String.prototype.replace
    // Patch replace to count backslash-normalization calls only
    String.prototype.replace = function (this: string, pattern: unknown, replacement: unknown) {
      if (pattern instanceof RegExp && pattern.source === '\\\\') {
        replaceCalls.push([pattern, replacement])
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return originalReplace.call(this, pattern as any, replacement as any)
    }

    try {
      // Already-normalized id — passing it through should trigger replace exactly once
      manualChunks.getElectronRendererManualChunk('foo/node_modules/bar/index.js')
    } finally {
      String.prototype.replace = originalReplace
    }

    // With double-normalization fixed: only 1 replace call on the outer normalizeModuleId.
    // If double-normalization still present: 2+ calls (once in getElectronRendererManualChunk,
    // once per hasNodePackage call).
    expect(replaceCalls.length).toBe(1)
  })
})
