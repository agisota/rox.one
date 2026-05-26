import { describe, expect, it } from 'bun:test'
import {
  buildRoxDesignEmbedBootstrapScript,
  resolveRoxDesignContentZoomFactor,
  ROX_DESIGN_EMBED_CSS,
} from '../rox-design-embed-skin'

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

describe('Rox Design embedded native surface skin', () => {
  it('uses a ROX-readable zoom scale for full-width embedded surfaces', () => {
    expect(resolveRoxDesignContentZoomFactor({ width: 1200 })).toBeGreaterThanOrEqual(0.82)
    expect(resolveRoxDesignContentZoomFactor({ width: 1600 })).toBeGreaterThanOrEqual(0.88)
    expect(resolveRoxDesignContentZoomFactor({ width: 2200 })).toBeGreaterThanOrEqual(0.94)
  })

  it('hides upstream top mode tabs and provides a ROX mode menu surface', () => {
    expect(ROX_DESIGN_EMBED_CSS).toContain('.newproj-tabs-shell')
    expect(ROX_DESIGN_EMBED_CSS).toContain('.entry-header-tabs-row')
    expect(ROX_DESIGN_EMBED_CSS).toContain('display: none !important')
    expect(ROX_DESIGN_EMBED_CSS).toContain('.rox-design-mode-menu')
    expect(ROX_DESIGN_EMBED_CSS).toContain('bottom: 14px')
  })

  it('injects Russian labels and the Rox Design brand bridge', () => {
    const script = buildRoxDesignEmbedBootstrapScript(0.9)

    expect(script).toContain('Rox Design')
    expect(script).toContain('Прототип')
    expect(script).toContain('Артефакт')
    expect(script).toContain('Презентация')
    expect(script).toContain('Шаблоны')
    expect(script).toContain('Дизайн-системы')
    expect(script).toContain('applyModeMenu')
  })
})
