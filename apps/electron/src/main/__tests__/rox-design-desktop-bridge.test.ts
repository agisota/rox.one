import { describe, expect, it, mock } from 'bun:test'
import { createHmac } from 'crypto'

mock.module('electron', () => ({
  // Provide `app` so cross-file test runs (which share module state in bun
  // test) can find it. Runtime-manager imports `app` directly; if this test's
  // mock wins the cache it must still satisfy that import.
  app: { isPackaged: false },
  BrowserWindow: class MockBrowserWindow {
    isDestroyed() { return false }
    webContents = {
      setWindowOpenHandler: () => undefined,
      on: () => undefined,
      executeJavaScript: () => Promise.resolve(true),
      print: (_opts: unknown, cb: (success: boolean) => void) => cb(true),
    }
    loadURL() { return Promise.resolve() }
    show() { return undefined }
    close() { return undefined }
    static getAllWindows() { return [] }
  },
  dialog: {
    showOpenDialog: mock(async () => ({ canceled: true, filePaths: [] })),
  },
  shell: {
    openExternal: mock(async () => undefined),
    openPath: mock(async () => ''),
  },
}))

const {
  DESKTOP_IMPORT_TOKEN_FIELD_SEP,
  isHttpUrl,
  isOpenPathAllowedForProject,
  signDesktopImportToken,
  RoxDesignDesktopBridge,
} = await import('../rox-design-desktop-bridge') as typeof import('../rox-design-desktop-bridge')

describe('Rox Design desktop bridge helpers', () => {
  it('allows only http(s) external URLs', () => {
    expect(isHttpUrl('https://example.com')).toBe(true)
    expect(isHttpUrl('http://example.com')).toBe(true)
    expect(isHttpUrl('file:///tmp/nope')).toBe(false)
    expect(isHttpUrl('javascript:alert(1)')).toBe(false)
  })

  it('keeps Open Design import token signing compatible with desktop runtime', () => {
    const secret = Buffer.from('secret')
    const token = signDesktopImportToken(secret, '/Users/me/project', {
      nonce: 'nonce',
      exp: '2026-05-19T00:00:00.000Z',
    })
    const expectedSignature = createHmac('sha256', secret)
      .update('/Users/me/project\nnonce\n2026-05-19T00:00:00.000Z')
      .digest('base64url')
    expect(token).toBe(['nonce', '2026-05-19T00:00:00.000Z', expectedSignature].join(DESKTOP_IMPORT_TOKEN_FIELD_SEP))
  })

  it('opens only project directories created by the trusted picker flow', () => {
    expect(isOpenPathAllowedForProject({ hasBaseDir: false, fromTrustedPicker: false })).toEqual({ ok: true })
    expect(isOpenPathAllowedForProject({ hasBaseDir: true, fromTrustedPicker: true })).toEqual({ ok: true })
    expect(isOpenPathAllowedForProject({ hasBaseDir: true, fromTrustedPicker: false })).toEqual({
      ok: false,
      reason: 'project did not come from the trusted picker flow',
    })
  })

  it('rejects printPdf when HTML payload exceeds the size cap', async () => {
    const bridge = new RoxDesignDesktopBridge(() => ({}))
    const oversizedHtml = '<html>' + 'x'.repeat(6 * 1024 * 1024) + '</html>'
    await expect(bridge.printPdf(oversizedHtml, 'nonce')).rejects.toThrow('exceeds')
  })
})
