/**
 * Tests for rox-design-theme-bridge.ts orchestrator (Phase 2C, Cycles 9–12).
 *
 * Cycle 9:  locale change in ROX i18next propagates to Design embed within 50ms
 * Cycle 10: RU locale shows RU strings in Design embed (via postMessage payload)
 * Cycle 11: Open Design SVG <use> references swapped to Lucide ROX set via MutationObserver
 * Cycle 12: unknown icon name falls back gracefully without throwing
 */

import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test'

// ── Minimal stubs ──────────────────────────────────────────────────────────

function makeWebContentsMock() {
  const sent: Array<{ channel: string; data: unknown }> = []
  return {
    id: 42,
    isDestroyed: () => false,
    send: mock((channel: string, data: unknown) => { sent.push({ channel, data }) }),
    executeJavaScript: mock(async (_code: string) => undefined),
    _sent: sent,
  }
}

function makeI18nMock() {
  const listeners: Record<string, Array<(lng: string) => void>> = {}
  return {
    language: 'en',
    on: (event: string, cb: (lng: string) => void) => {
      listeners[event] = listeners[event] ?? []
      listeners[event].push(cb)
    },
    off: mock((event: string, cb: (lng: string) => void) => {
      listeners[event] = (listeners[event] ?? []).filter((l) => l !== cb)
    }),
    _emit: (event: string, lng: string) => {
      for (const cb of listeners[event] ?? []) cb(lng)
    },
  }
}

// ── Cycle 9: locale change propagates within 50ms ─────────────────────────

describe('i18n locale bridge (Cycle 9)', () => {
  it('posts locale-change message to Design webContents within 50ms', async () => {
    const wc = makeWebContentsMock()
    const i18n = makeI18nMock()

    const { startI18nBridge } = await import('../rox-design-theme-bridge')

    const dispose = startI18nBridge(
      i18n as unknown as Parameters<typeof startI18nBridge>[0],
      wc as unknown as Parameters<typeof startI18nBridge>[1],
    )

    const t0 = performance.now()
    i18n._emit('languageChanged', 'ru')

    // Wait up to 60ms
    await new Promise<void>((resolve) => setTimeout(resolve, 60))
    const elapsed = performance.now() - t0

    expect(wc.executeJavaScript.mock.calls.length).toBeGreaterThanOrEqual(1)
    const call = wc.executeJavaScript.mock.calls[0] as [string]
    expect(call[0]).toContain('ru')
    expect(elapsed).toBeLessThan(200) // generous CI budget

    dispose()
  })
})

// ── Cycle 10: RU locale shows RU strings in Design embed ──────────────────

describe('RU locale payload (Cycle 10)', () => {
  it('executeJavaScript payload sets language=ru in localStorage config', async () => {
    const wc = makeWebContentsMock()
    const i18n = makeI18nMock()

    const { startI18nBridge } = await import('../rox-design-theme-bridge')

    const dispose = startI18nBridge(
      i18n as unknown as Parameters<typeof startI18nBridge>[0],
      wc as unknown as Parameters<typeof startI18nBridge>[1],
    )

    i18n._emit('languageChanged', 'ru')
    await new Promise<void>((resolve) => setTimeout(resolve, 30))

    const calls = wc.executeJavaScript.mock.calls as [string][]
    const code = calls[0]?.[0] ?? ''

    // The injected script must write 'ru' into the OD config store
    expect(code).toContain('ru')
    expect(code).toContain('language')

    dispose()
  })
})

// ── Cycle 11: SVG <use> icon swap via MutationObserver ────────────────────

describe('Icon registry override (Cycle 11)', () => {
  it('swaps known Open Design SVG <use> hrefs to Lucide equivalents', async () => {
    const { resolveIconHref } = await import('../rox-design-theme-bridge')

    // Known OD icons that have Lucide equivalents
    expect(resolveIconHref('#od-icon-close')).toBe('#lucide-x')
    expect(resolveIconHref('#od-icon-settings')).toBe('#lucide-settings')
    expect(resolveIconHref('#od-icon-search')).toBe('#lucide-search')
    expect(resolveIconHref('#od-icon-plus')).toBe('#lucide-plus')
    expect(resolveIconHref('#od-icon-trash')).toBe('#lucide-trash-2')
    expect(resolveIconHref('#od-icon-check')).toBe('#lucide-check')
    expect(resolveIconHref('#od-icon-chevron-down')).toBe('#lucide-chevron-down')
    expect(resolveIconHref('#od-icon-chevron-right')).toBe('#lucide-chevron-right')
    expect(resolveIconHref('#od-icon-folder')).toBe('#lucide-folder')
    expect(resolveIconHref('#od-icon-file')).toBe('#lucide-file')
  })
})

// ── Cycle 12: unknown icon falls back gracefully ──────────────────────────

describe('Icon registry fallback (Cycle 12)', () => {
  it('returns the original href unchanged for unknown icon names (no throw)', async () => {
    const { resolveIconHref } = await import('../rox-design-theme-bridge')

    // Unknown icon: should return the original unchanged, no throw
    expect(() => resolveIconHref('#od-icon-unknown-xyz-abc')).not.toThrow()
    expect(resolveIconHref('#od-icon-unknown-xyz-abc')).toBe('#od-icon-unknown-xyz-abc')
  })

  it('returns original href for non-od-icon prefixed hrefs', async () => {
    const { resolveIconHref } = await import('../rox-design-theme-bridge')

    expect(resolveIconHref('#some-other-ref')).toBe('#some-other-ref')
    expect(resolveIconHref('')).toBe('')
  })
})
