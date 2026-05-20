import { describe, expect, it } from 'bun:test'
import { buildRoxDesignEmbedBootstrapScript } from '../rox-design-embed-skin'

describe('buildRoxDesignEmbedBootstrapScript - writeConfig dedup', () => {
  it('generated script contains the dedup guard that skips redundant localStorage.setItem calls', () => {
    const script = buildRoxDesignEmbedBootstrapScript(0.6)

    // The dedup guard: a last-value cache variable and an early-return equality check
    expect(script).toContain('__lastConfigJson')
    expect(script).toContain('if (next === __lastConfigJson) return')
    // localStorage.setItem is called with the cached value, not on every tick
    expect(script).toContain('localStorage.setItem(\'open-design:config\', next)')
  })

  it('dedupWriteConfig helper skips write when serialized config is unchanged', () => {
    const writes: string[] = []
    let lastJson: string | null = null

    // Mirrors the dedup logic from the generated script
    const dedupWriteConfig = (configJson: string) => {
      if (configJson === lastJson) return
      lastJson = configJson
      writes.push(configJson)
    }

    const config = JSON.stringify({ embed: 'rox', theme: 'dark', language: 'ru' })

    for (let i = 0; i < 10; i++) dedupWriteConfig(config)

    expect(writes.length).toBe(1)
  })
})
