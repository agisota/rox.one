/**
 * PZD-80: Factory helpers for integration tests.
 *
 * `mockManifest` returns a valid `IntegrationManifest` for tests. We stub the
 * manifest shape inline here because the real type is being built concurrently
 * by PZD-78.
 *
 * FIXME(PZD-78): import from `@rox-one/shared/integrations/manifest` once that
 * lands. Until then we mirror only the fields we actually use in tests, kept
 * loose enough that callers can pass through to production code without
 * coupling to PZD-78's exact field names. When PZD-78 merges, replace the
 * local `IntegrationManifest` alias below with the canonical import and adjust
 * `mockManifest` defaults.
 */
import {
  MockWebContentsView,
  type MockWebContents,
} from './mock-web-contents-view'

/**
 * Local stub of `IntegrationManifest` used by tests until PZD-78 ships the
 * canonical type. Keep this aligned with the spec at
 * docs/superpowers/specs/2026-05-20-rox-integration-vision-design.md § 2.2.A.
 */
export interface IntegrationManifest {
  id: string
  kind: 'webContentsView' | 'browserView' | 'in-process'
  partition: string
  preloadPath?: string
  initialUrl?: string
  webPreferences?: {
    contextIsolation?: boolean
    nodeIntegration?: boolean
    sandbox?: boolean
    webviewTag?: boolean
    partition?: string
    preload?: string
  }
}

export interface MockSecureWebContentsView {
  view: MockWebContentsView
  webContents: MockWebContents
  webPreferences: Required<NonNullable<IntegrationManifest['webPreferences']>>
}

/**
 * Default manifest with sensible secure-baseline values. Tests override only
 * the fields they care about.
 */
export function mockManifest(
  overrides: Partial<IntegrationManifest> = {},
): IntegrationManifest {
  return {
    id: 'mock-integration',
    kind: 'webContentsView',
    partition: 'persist:mock-integration',
    preloadPath: '/fake/preload.cjs',
    initialUrl: 'about:blank',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false,
      partition: 'persist:mock-integration',
      preload: '/fake/preload.cjs',
    },
    ...overrides,
  }
}

/**
 * Build a `MockWebContentsView` plus the secure `webPreferences` it would have
 * been constructed with. Mirrors the eventual `createSecureWebContentsView`
 * helper so tests can assert the security baseline without instantiating a
 * real Electron `WebContentsView`.
 */
export function mockWebContentsViewFor(
  manifest: Partial<IntegrationManifest> = {},
): MockSecureWebContentsView {
  const merged = mockManifest(manifest)
  const view = new MockWebContentsView()
  return {
    view,
    webContents: view.webContents,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false,
      partition: merged.partition,
      preload: merged.preloadPath ?? '/fake/preload.cjs',
    },
  }
}

/**
 * Close every mock view passed in. Safe to call multiple times — closes are
 * idempotent at the `MockWebContentsView.close()` boundary. Use in afterEach
 * to guarantee no listeners leak across tests.
 */
export function disposeMocks(...views: MockWebContentsView[]): void {
  for (const view of views) {
    if (!view.webContents.isDestroyed()) {
      view.webContents.close()
    }
  }
}
