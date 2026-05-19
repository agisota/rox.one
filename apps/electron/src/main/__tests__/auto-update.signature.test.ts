/**
 * Integration tests for auto-update signature verification.
 *
 * P0 security surface: a compromised update channel could deploy arbitrary
 * code to all users silently. These tests assert that the module wiring
 * correctly delegates signature checking to electron-updater (which handles
 * code-sign cert validation on macOS and Authenticode on Windows) and that
 * error paths surface properly rather than being swallowed.
 *
 * All update server responses are mocked — no real network calls are made.
 *
 * Weaknesses found during implementation (see PR body for details):
 *   W-1: autoUpdater.error event handler sets downloadState='error' but did
 *        NOT log when no EventSink connected — ops blind to cert-chain attacks.
 *        FIX: mainLog.error() is called unconditionally before broadcastUpdateInfo().
 *   W-2: checkForUpdates() caught errors and returned normally (no throw),
 *        so callers could not use try/catch.
 *        FIX: checkForUpdates() now re-throws on failure.
 *   W-3: Downgrade protection was entirely delegated to electron-updater's
 *        semver comparison; no independent version guard existed.
 *        FIX: update-available handler now independently compares via semver
 *        and refuses any version not strictly greater than current.
 *   W-4: The 500ms setTimeout in checkForUpdates() was a timing assumption
 *        that could race under load.
 *        FIX: replaced with event-based waiting that resolves on
 *        update-downloaded / update-not-available / error events.
 */

import { describe, it, expect, beforeEach, afterAll, mock } from 'bun:test'
import * as realSharedConfig from '@rox-one/shared/config'
import * as realSharedFiles from '@rox-one/shared/utils/files'
import * as realSharedVersion from '@rox-one/shared/version'
import * as realFs from 'node:fs'
import * as realOs from 'node:os'
import * as realPath from 'node:path'

const actualGetDismissedUpdateVersion = realSharedConfig.getDismissedUpdateVersion
const actualClearDismissedUpdateVersion = realSharedConfig.clearDismissedUpdateVersion
const actualGetAutoDownloadUpdates = realSharedConfig.getAutoDownloadUpdates
const actualSetAutoDownloadUpdates = realSharedConfig.setAutoDownloadUpdates
const actualGetUpdateChannel = realSharedConfig.getUpdateChannel
const actualSetUpdateChannel = realSharedConfig.setUpdateChannel
const actualGetAppVersion = realSharedVersion.getAppVersion
const actualReadJsonFileSync = realSharedFiles.readJsonFileSync
const actualFsExistsSync = realFs.existsSync
const actualFsReaddirSync = realFs.readdirSync
const actualPathJoin = realPath.join
const actualOsPlatform = realOs.platform

// ─── Mock logger first (before any module under test is imported) ─────────────

const logCalls: { level: string; args: unknown[] }[] = []

mock.module('../logger', () => {
  const makeLog =
    (level: string) =>
    (...args: unknown[]) => {
      logCalls.push({ level, args })
    }
  const stubLog = {
    info: makeLog('info'),
    warn: makeLog('warn'),
    error: makeLog('error'),
    debug: makeLog('debug'),
  }
  return {
    mainLog: stubLog,
    sessionLog: stubLog,
    handlerLog: stubLog,
    windowLog: stubLog,
    agentLog: stubLog,
    searchLog: stubLog,
    isDebugMode: false,
    getLogFilePath: () => '/tmp/main.log',
  }
})

// ─── Mock Electron ─────────────────────────────────────────────────────────────

class MockBrowserWindow {
  static fromWebContents = mock((_webContents: unknown) => null)
  static getFocusedWindow = mock(() => null)
  static getAllWindows = mock(() => [])

  webContents = {
    id: 1,
    reload: mock(() => {}),
    reloadIgnoringCache: mock(() => {}),
    send: mock((_channel: string, _payload?: unknown) => {}),
  }

  getBrowserViews = mock(() => [])
}

class MockBrowserView {
  webContents = {
    id: 2,
    reload: mock(() => {}),
    reloadIgnoringCache: mock(() => {}),
    send: mock((_channel: string, _payload?: unknown) => {}),
  }
}

const mockNativeImage = () => ({
  isEmpty: () => true,
  getSize: () => ({ width: 0, height: 0 }),
  resize: () => mockNativeImage(),
  toPNG: () => Buffer.from(''),
  toJPEG: () => Buffer.from(''),
})

const mockSession = {
  setPermissionCheckHandler: mock((_handler: unknown) => {}),
  setPermissionRequestHandler: mock((_handler: unknown) => {}),
  webRequest: {
    onBeforeRequest: mock((_handler: unknown) => {}),
    onCompleted: mock((_handler: unknown) => {}),
    onErrorOccurred: mock((_handler: unknown) => {}),
  },
  on: mock((_event: string, _handler: unknown) => {}),
}

mock.module('electron', () => ({
  app: {
    isPackaged: false,
    getName: mock(() => 'rox-one'),
    getPath: mock((name: string) => `/tmp/mock-${name}`),
    getAppPath: mock(() => '/tmp/mock-app'),
    quit: mock(() => {}),
    exit: mock((_code?: number) => {}),
    dock: { setIcon: mock((_icon: unknown) => {}), setBadge: mock((_badge: string) => {}) },
    setBadgeCount: mock((_count: number) => {}),
  },
  BrowserWindow: MockBrowserWindow,
  BrowserView: MockBrowserView,
  Menu: {
    buildFromTemplate: mock((_template: unknown[]) => ({ popup: mock(() => {}) })),
    setApplicationMenu: mock((_menu: unknown) => {}),
    getApplicationMenu: mock(() => null),
  },
  ipcMain: {
    handle: mock(() => {}),
    on: mock(() => {}),
    removeHandler: mock(() => {}),
    removeAllListeners: mock(() => {}),
  },
  nativeTheme: {
    shouldUseDarkColors: false,
    on: mock((_event: string, _handler: unknown) => {}),
  },
  nativeImage: {
    createFromPath: mock((_path: string) => mockNativeImage()),
    createFromDataURL: mock((_url: string) => mockNativeImage()),
    createFromBuffer: mock((_buffer: Buffer) => mockNativeImage()),
    createEmpty: mock(() => mockNativeImage()),
  },
  dialog: {
    showOpenDialog: mock(async () => ({ canceled: true, filePaths: [] })),
    showMessageBox: mock(async () => ({ response: 0 })),
  },
  shell: {
    openExternal: mock(async () => {}),
    openPath: mock(async () => ''),
    showItemInFolder: mock((_path: string) => {}),
  },
  screen: {
    getDisplayMatching: mock(() => ({ workArea: { x: 0, y: 0, width: 1440, height: 900 } })),
  },
  session: {
    defaultSession: mockSession,
    fromPartition: mock((_partition: string) => mockSession),
  },
  safeStorage: {
    isEncryptionAvailable: mock(() => false),
    encryptString: mock((value: string) => Buffer.from(value)),
    decryptString: mock((value: Buffer) => value.toString('utf8')),
  },
  powerSaveBlocker: {
    start: mock((_type: string) => 1),
    stop: mock((_id: number) => {}),
    isStarted: mock((_id: number) => false),
  },
  Notification: class {
    static isSupported() { return false }
    on() {}
    show() {}
  },
}))

// ─── Mock shared modules ───────────────────────────────────────────────────────

const mockGetAppVersion = mock(actualGetAppVersion)
mockGetAppVersion.mockImplementation(() => '0.9.2')

mock.module('@rox-one/shared/version', () => ({
  ...realSharedVersion,
  getAppVersion: mockGetAppVersion,
  APP_VERSION: '0.9.2',
}))

const mockGetDismissedUpdateVersion = mock(actualGetDismissedUpdateVersion)
const mockClearDismissedUpdateVersion = mock(actualClearDismissedUpdateVersion)
const mockGetAutoDownloadUpdates = mock(actualGetAutoDownloadUpdates)
const mockSetAutoDownloadUpdates = mock(actualSetAutoDownloadUpdates)
const mockGetUpdateChannel = mock(actualGetUpdateChannel)
const mockSetUpdateChannel = mock(actualSetUpdateChannel)
mockGetDismissedUpdateVersion.mockImplementation(() => null)
mockClearDismissedUpdateVersion.mockImplementation(() => {})
mockGetAutoDownloadUpdates.mockImplementation(() => true)
mockSetAutoDownloadUpdates.mockImplementation(() => {})
mockGetUpdateChannel.mockImplementation(() => 'stable')
mockSetUpdateChannel.mockImplementation(() => {})

mock.module('@rox-one/shared/config', () => ({
  ...realSharedConfig,
  getDismissedUpdateVersion: mockGetDismissedUpdateVersion,
  clearDismissedUpdateVersion: mockClearDismissedUpdateVersion,
  getAutoDownloadUpdates: mockGetAutoDownloadUpdates,
  setAutoDownloadUpdates: mockSetAutoDownloadUpdates,
  getUpdateChannel: mockGetUpdateChannel,
  setUpdateChannel: mockSetUpdateChannel,
}))

const mockReadJsonFileSync = mock(actualReadJsonFileSync)
mockReadJsonFileSync.mockImplementation(() => null)

mock.module('@rox-one/shared/utils/files', () => ({
  ...realSharedFiles,
  readJsonFileSync: mockReadJsonFileSync,
}))

// ─── Mock menu (async import inside update-downloaded handler) ────────────────

mock.module('../menu', () => ({
  createApplicationMenu: mock(() => {}),
  setMenuEventSink: mock(() => {}),
  rebuildMenu: mock(() => {}),
}))

// ─── Mock fs (used by checkForExistingDownload) ────────────────────────────────

const mockFsExistsSync = mock(actualFsExistsSync)
const mockFsReaddirSync = mock(actualFsReaddirSync)
mockFsExistsSync.mockImplementation(() => false)
mockFsReaddirSync.mockImplementation(() => [])

const mockFsModule = () => ({
  ...realFs,
  existsSync: mockFsExistsSync,
  readdirSync: mockFsReaddirSync,
})

mock.module('fs', mockFsModule)
mock.module('node:fs', mockFsModule)

// ─── Mock path (used by getUpdateCacheDir) ─────────────────────────────────────

const mockPathJoin = mock(actualPathJoin)
mockPathJoin.mockImplementation((...parts: string[]) => parts.join('/'))

const mockPathModule = () => ({
  ...realPath,
  join: mockPathJoin,
})

mock.module('path', mockPathModule)
mock.module('node:path', mockPathModule)

// ─── Mock os ──────────────────────────────────────────────────────────────────

const mockOsPlatform = mock(actualOsPlatform)
mockOsPlatform.mockImplementation(() => 'linux')

const mockOsModule = () => ({
  ...realOs,
  platform: mockOsPlatform,
})

mock.module('os', mockOsModule)
mock.module('node:os', mockOsModule)

afterAll(() => {
  mockGetAppVersion.mockImplementation(actualGetAppVersion)
  mockGetDismissedUpdateVersion.mockImplementation(actualGetDismissedUpdateVersion)
  mockClearDismissedUpdateVersion.mockImplementation(actualClearDismissedUpdateVersion)
  mockGetAutoDownloadUpdates.mockImplementation(actualGetAutoDownloadUpdates)
  mockSetAutoDownloadUpdates.mockImplementation(actualSetAutoDownloadUpdates)
  mockGetUpdateChannel.mockImplementation(actualGetUpdateChannel)
  mockSetUpdateChannel.mockImplementation(actualSetUpdateChannel)
  mockReadJsonFileSync.mockImplementation(actualReadJsonFileSync)
  mockFsExistsSync.mockImplementation(actualFsExistsSync)
  mockFsReaddirSync.mockImplementation(actualFsReaddirSync)
  mockPathJoin.mockImplementation(actualPathJoin)
  mockOsPlatform.mockImplementation(actualOsPlatform)
})

// semver is NOT mocked — the real package is used so W-3 tests exercise
// actual semver comparison logic. Only platform-native and unavailable
// modules (electron, electron-updater, etc.) are mocked.

// ─── electron-updater mock — the heart of these tests ─────────────────────────
// electron-updater's autoUpdater is the security boundary. We assert:
//   a) our module correctly configures it (logger, autoDownload, etc.)
//   b) our event handlers respond correctly to the events it emits
//   c) checkForUpdates() propagates errors rather than swallowing them silently

type EventHandler = (...args: unknown[]) => void | Promise<void>
type MockUpdateResult = { updateInfo: null | { version: string } }
const autoUpdaterListeners: Record<string, EventHandler[]> = {}

// Tracks calls made to the mocked autoUpdater
const mockCheckForUpdates = mock(async (): Promise<MockUpdateResult> => ({ updateInfo: null }))
const mockQuitAndInstall = mock((_isSilent: boolean, _isForceRunAfter: boolean) => {})
const mockDownloadUpdate = mock(async () => [])
const mockSetFeedURL = mock((_options: unknown) => {})

const mockAutoUpdater = {
  autoDownload: true,
  autoInstallOnAppQuit: true,
  logger: null as unknown,
  downloadedUpdateHelper: null as unknown,
  allowPrerelease: false,

  on: (event: string, handler: EventHandler) => {
    if (!autoUpdaterListeners[event]) autoUpdaterListeners[event] = []
    autoUpdaterListeners[event].push(handler)
  },

  checkForUpdates: mockCheckForUpdates,
  downloadUpdate: mockDownloadUpdate,
  quitAndInstall: mockQuitAndInstall,
  setFeedURL: mockSetFeedURL,

  // Helper used in tests to simulate events fired by electron-updater internals
  _emit: async (event: string, ...args: unknown[]) => {
    for (const handler of autoUpdaterListeners[event] ?? []) {
      await handler(...args)
    }
  },
}

mock.module('electron-updater', () => ({
  autoUpdater: mockAutoUpdater,
}))

// ─── Import module under test (after all mocks are in place) ──────────────────

const {
  checkForUpdates,
  getUpdateInfo,
  setAutoUpdateEventSink,
  isUpdating,
  installUpdate,
  downloadUpdate,
  getUpdateSettings,
  setUpdateSettings,
  checkForUpdatesOnLaunch,
} = await import('../auto-update.ts' + '?sig-test') as typeof import('../auto-update.ts')

// ─── Test utilities ───────────────────────────────────────────────────────────

function clearLogCalls() {
  logCalls.length = 0
}

function hasLogMatching(level: string, fragment: string): boolean {
  return logCalls.some(
    (entry) =>
      entry.level === level &&
      entry.args.some((arg) => typeof arg === 'string' && arg.includes(fragment)),
  )
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('auto-update module configuration', () => {
  it('configures autoDownload=true on module load', () => {
    // The module sets autoDownload=true at import time
    expect(mockAutoUpdater.autoDownload).toBe(true)
  })

  it('configures autoInstallOnAppQuit=true on module load', () => {
    expect(mockAutoUpdater.autoInstallOnAppQuit).toBe(true)
  })

  it('installs a structured logger on autoUpdater', () => {
    // The logger must be present — electron-updater uses it for signature
    // verification output so we can observe cert errors in logs.
    expect(mockAutoUpdater.logger).not.toBeNull()
    const logger = mockAutoUpdater.logger as Record<string, unknown>
    expect(typeof logger.info).toBe('function')
    expect(typeof logger.warn).toBe('function')
    expect(typeof logger.error).toBe('function')
  })

  it('registers all required event handlers on autoUpdater', () => {
    // These handlers are the integration points between electron-updater's
    // internal state machine and our UI layer.
    const requiredEvents = [
      'checking-for-update',
      'update-available',
      'update-not-available',
      'download-progress',
      'update-downloaded',
      'error',
    ]
    for (const event of requiredEvents) {
      expect(
        autoUpdaterListeners[event]?.length,
        `Expected handler registered for '${event}'`,
      ).toBeGreaterThan(0)
    }
  })
})



describe('auto-update channel settings and manual download', () => {
  beforeEach(() => {
    mockSetFeedURL.mockClear()
    mockDownloadUpdate.mockClear()
    mockSetAutoDownloadUpdates.mockClear()
    mockSetUpdateChannel.mockClear()
    mockGetAutoDownloadUpdates.mockImplementation(() => true)
    mockGetUpdateChannel.mockImplementation(() => 'stable')
    mockAutoUpdater.allowPrerelease = false
    mockAutoUpdater.autoDownload = true
  })

  it('uses stable feed and default auto-download settings', () => {
    const settings = getUpdateSettings()
    expect(settings).toEqual({ autoDownloadUpdates: true, updateChannel: 'stable' })
    expect(mockAutoUpdater.autoDownload).toBe(true)
    expect(mockAutoUpdater.allowPrerelease).toBe(false)
    expect(mockSetFeedURL).toHaveBeenCalledWith({ provider: 'generic', url: 'https://app.rox.one/electron/stable/', channel: 'latest' })
  })

  it('switches to beta feed and allows prerelease checks', () => {
    setUpdateSettings({ updateChannel: 'beta' })
    expect(mockSetUpdateChannel).toHaveBeenCalledWith('beta')
    expect(mockAutoUpdater.allowPrerelease).toBe(true)
    expect(mockSetFeedURL).toHaveBeenLastCalledWith({ provider: 'generic', url: 'https://app.rox.one/electron/beta/', channel: 'beta' })
  })

  it('ignores invalid runtime update settings before configuring the feed', () => {
    const settings = setUpdateSettings({
      autoDownloadUpdates: 'yes' as unknown as boolean,
      updateChannel: 'https://evil.example/feed' as unknown as 'stable',
    })

    expect(settings).toEqual({ autoDownloadUpdates: true, updateChannel: 'stable' })
    expect(mockSetAutoDownloadUpdates).not.toHaveBeenCalled()
    expect(mockSetUpdateChannel).not.toHaveBeenCalled()
    expect(mockSetFeedURL).toHaveBeenLastCalledWith({ provider: 'generic', url: 'https://app.rox.one/electron/stable/', channel: 'latest' })
  })

  it('manual check respects disabled auto-download and leaves update ready for explicit download', async () => {
    mockCheckForUpdates.mockImplementation(async () => {
      await mockAutoUpdater._emit('update-available', { version: '1.0.0' })
      return { updateInfo: { version: '1.0.0' } }
    })

    const result = await checkForUpdates({ autoDownload: false })
    expect(result.available).toBe(true)
    expect(result.downloadState).toBe('idle')
    expect(mockAutoUpdater.autoDownload).toBe(true)
  })

  it('downloadUpdate delegates to electron-updater and marks downloading', async () => {
    await downloadUpdate()
    expect(mockDownloadUpdate).toHaveBeenCalled()
    expect(getUpdateInfo().downloadState).toBe('downloading')
  })
})

describe('Scenario 1: Signature mismatch is rejected', () => {
  /**
   * electron-updater fires the 'error' event when signature validation fails.
   * Our error handler MUST:
   *   - log the error unconditionally (W-1 fix: regardless of EventSink)
   *   - set downloadState to 'error' (NOT 'ready' or 'downloading')
   *   - NOT set available=true
   *
   * W-2 fix: checkForUpdates() now re-throws so callers can use try/catch.
   */
  beforeEach(() => {
    clearLogCalls()
    mockCheckForUpdates.mockImplementation(async () => {
      // Simulate electron-updater rejecting the update due to signature failure.
      // In production this error message includes the cert chain details.
      await mockAutoUpdater._emit(
        'error',
        new Error(
          'Error: Update signature verification failed: The signature of the update file is invalid. ' +
            'Expected: SHA256:abc123... Actual: SHA256:tampered...',
        ),
      )
      return { updateInfo: null }
    })
  })

  it('throws when signature verification fails (W-2)', async () => {
    // W-2: callers can now use try/catch instead of inspecting downloadState
    await expect(checkForUpdates()).rejects.toThrow()
  })

  it('sets downloadState to error when signature verification fails', async () => {
    try { await checkForUpdates() } catch { /* expected */ }
    expect(getUpdateInfo().downloadState).toBe('error')
  })

  it('does not mark update as available when signature fails', async () => {
    try { await checkForUpdates() } catch { /* expected */ }
    expect(getUpdateInfo().available).toBe(false)
  })

  it('logs the signature error at error level regardless of EventSink (W-1)', async () => {
    // W-1: ensure no EventSink is connected — error must still be logged
    setAutoUpdateEventSink(null as never)
    try { await checkForUpdates() } catch { /* expected */ }
    const hasError = hasLogMatching('error', 'Error')
    expect(hasError).toBe(true)
  })

  it('stores the error message in UpdateInfo', async () => {
    try { await checkForUpdates() } catch { /* expected */ }
    const info = getUpdateInfo()
    expect(info.error).toBeDefined()
    expect(typeof info.error).toBe('string')
  })

  it('does not call quitAndInstall after a signature error', async () => {
    mockQuitAndInstall.mockClear()
    try { await checkForUpdates() } catch { /* expected */ }
    expect(mockQuitAndInstall).not.toHaveBeenCalled()
  })
})

describe('Scenario 2: Stale-version downgrade is blocked (electron-updater path)', () => {
  /**
   * electron-updater fires 'update-not-available' when the remote version
   * is <= the current version (semver comparison). Our handler MUST set
   * available=false so the UI never offers a downgrade install.
   *
   * Current version: 0.9.2 (set in @rox-one/shared/version mock above)
   * Remote manifest: version 0.1.0 (older)
   */
  beforeEach(() => {
    clearLogCalls()
    mockCheckForUpdates.mockImplementation(async () => {
      // electron-updater emits update-not-available when remote version <= current
      await mockAutoUpdater._emit('update-not-available', { version: '0.1.0' })
      return { updateInfo: { version: '0.1.0' } }
    })
  })

  it('sets available=false when remote version is older', async () => {
    const result = await checkForUpdates()
    expect(result.available).toBe(false)
  })

  it('sets downloadState to idle when update is not available', async () => {
    const result = await checkForUpdates()
    expect(result.downloadState).toBe('idle')
  })

  it('records the remote version in latestVersion for diagnostics', async () => {
    const result = await checkForUpdates()
    // We know what version the server returned (0.1.0) — store it for telemetry
    expect(result.latestVersion).toBe('0.1.0')
  })

  it('does not call quitAndInstall for a downgrade attempt', async () => {
    mockQuitAndInstall.mockClear()
    await checkForUpdates()
    expect(mockQuitAndInstall).not.toHaveBeenCalled()
  })

  it('logs that the app is already up to date', async () => {
    await checkForUpdates()
    // The source logs: '[auto-update] Already up to date (X.Y.Z)'
    const hasUpToDate = hasLogMatching('info', 'up to date')
    expect(hasUpToDate).toBe(true)
  })
})

describe('Scenario 2b: Independent downgrade guard (W-3)', () => {
  /**
   * W-3: Even if electron-updater incorrectly fires 'update-available' for an
   * older version (e.g., via a forged manifest or library bypass), our
   * independent semver guard in the update-available handler must block the
   * downgrade and set available=false.
   *
   * Current version: 0.9.2
   * Forged manifest: version 0.1.0 (older — should be blocked independently)
   */
  beforeEach(() => {
    clearLogCalls()
    mockFsExistsSync.mockImplementation(() => false)
    mockFsReaddirSync.mockImplementation(() => [])
    mockAutoUpdater.downloadedUpdateHelper = null
  })

  it('blocks a forged update-available event with an older version (W-3)', async () => {
    mockCheckForUpdates.mockImplementation(async () => {
      // Forged: electron-updater emits update-available for an older version
      await mockAutoUpdater._emit('update-available', { version: '0.1.0' })
      return { updateInfo: { version: '0.1.0' } }
    })

    const result = await checkForUpdates()
    expect(result.available).toBe(false)
    expect(result.downloadState).toBe('idle')
  })

  it('blocks a forged update-available event with the same version (W-3)', async () => {
    mockCheckForUpdates.mockImplementation(async () => {
      // Same version — not an upgrade
      await mockAutoUpdater._emit('update-available', { version: '0.9.2' })
      return { updateInfo: { version: '0.9.2' } }
    })

    const result = await checkForUpdates()
    expect(result.available).toBe(false)
    expect(result.downloadState).toBe('idle')
  })

  it('logs DOWNGRADE BLOCKED at warn level when guard fires (W-3)', async () => {
    mockCheckForUpdates.mockImplementation(async () => {
      await mockAutoUpdater._emit('update-available', { version: '0.1.0' })
      return { updateInfo: { version: '0.1.0' } }
    })

    await checkForUpdates()
    const hasWarn = hasLogMatching('warn', 'DOWNGRADE BLOCKED')
    expect(hasWarn).toBe(true)
  })

  it('does not block a legitimate newer version (W-3 guard passes)', async () => {
    mockCheckForUpdates.mockImplementation(async () => {
      await mockAutoUpdater._emit('update-available', { version: '1.0.0' })
      // Resolve the event wait immediately
      await mockAutoUpdater._emit('update-downloaded', { version: '1.0.0' })
      return { updateInfo: { version: '1.0.0' } }
    })

    const result = await checkForUpdates()
    expect(result.available).toBe(true)
  })

  it('does not call quitAndInstall when downgrade guard fires', async () => {
    mockCheckForUpdates.mockImplementation(async () => {
      await mockAutoUpdater._emit('update-available', { version: '0.1.0' })
      return { updateInfo: { version: '0.1.0' } }
    })

    mockQuitAndInstall.mockClear()
    await checkForUpdates()
    expect(mockQuitAndInstall).not.toHaveBeenCalled()
  })
})

describe('Scenario 3: Network failure handling', () => {
  /**
   * When the update server is unreachable or returns a non-200, electron-updater
   * rejects the checkForUpdates() promise.
   *
   * W-2 fix: checkForUpdates() now re-throws after catching the network error,
   * so callers CAN use try/catch. The caller decides whether to surface or swallow.
   * checkForUpdatesOnLaunch() demonstrates the swallow pattern for launch resilience.
   */
  beforeEach(() => {
    clearLogCalls()
    mockCheckForUpdates.mockImplementation(async () => {
      throw new Error('ECONNREFUSED: connect ECONNREFUSED 127.0.0.1:443')
    })
  })

  it('re-throws when the update server is unreachable (W-2)', async () => {
    // W-2 fix: callers can now try/catch network failures
    await expect(checkForUpdates()).rejects.toThrow('ECONNREFUSED')
  })

  it('sets downloadState to error on network failure', async () => {
    try { await checkForUpdates() } catch { /* expected */ }
    expect(getUpdateInfo().downloadState).toBe('error')
  })

  it('populates UpdateInfo.error with the failure reason', async () => {
    try { await checkForUpdates() } catch { /* expected */ }
    expect(getUpdateInfo().error).toContain('ECONNREFUSED')
  })

  it('logs the network failure at error level', async () => {
    try { await checkForUpdates() } catch { /* expected */ }
    const hasError = hasLogMatching('error', 'Check failed')
    expect(hasError).toBe(true)
  })

  it('does not mark an update as available after a network failure', async () => {
    try { await checkForUpdates() } catch { /* expected */ }
    expect(getUpdateInfo().available).toBe(false)
  })

  it('does not call quitAndInstall after a network failure', async () => {
    mockQuitAndInstall.mockClear()
    try { await checkForUpdates() } catch { /* expected */ }
    expect(mockQuitAndInstall).not.toHaveBeenCalled()
  })
})

describe('Scenario 4: Successful path — valid signed manifest with newer version', () => {
  /**
   * Happy path: electron-updater successfully validates the signature,
   * determines the remote version is newer, and fires 'update-available'.
   * Our handler MUST:
   *   - set available=true
   *   - set latestVersion to the new version string
   *   - set downloadState to 'downloading' (autoDownload=true)
   * After download completes, electron-updater fires 'update-downloaded' and
   * our handler MUST set downloadState to 'ready'.
   *
   * W-4 fix: checkForUpdates() now waits for the update-downloaded event
   * instead of a fixed 500 ms wall-clock sleep. The mock emits events
   * synchronously, so no real wall-clock time elapses in these tests.
   */
  beforeEach(() => {
    clearLogCalls()
    // No existing cache files
    mockFsExistsSync.mockImplementation(() => false)
    mockFsReaddirSync.mockImplementation(() => [])
    // No internal downloadedUpdateHelper state
    mockAutoUpdater.downloadedUpdateHelper = null
  })

  it('sets available=true when a newer signed update is found', async () => {
    mockCheckForUpdates.mockImplementation(async () => {
      await mockAutoUpdater._emit('update-available', { version: '1.0.0' })
      await mockAutoUpdater._emit('update-downloaded', { version: '1.0.0' })
      return { updateInfo: { version: '1.0.0' } }
    })

    const result = await checkForUpdates()
    expect(result.available).toBe(true)
  })

  it('records the new version in latestVersion', async () => {
    mockCheckForUpdates.mockImplementation(async () => {
      await mockAutoUpdater._emit('update-available', { version: '1.0.0' })
      await mockAutoUpdater._emit('update-downloaded', { version: '1.0.0' })
      return { updateInfo: { version: '1.0.0' } }
    })

    const result = await checkForUpdates()
    expect(result.latestVersion).toBe('1.0.0')
  })

  it('sets downloadState to downloading before update-downloaded fires (intermediate state)', async () => {
    // Verify intermediate state captured after update-available but before update-downloaded
    let intermediateState: string | undefined

    mockCheckForUpdates.mockImplementation(async () => {
      await mockAutoUpdater._emit('update-available', { version: '1.0.0' })
      intermediateState = getUpdateInfo().downloadState
      await mockAutoUpdater._emit('update-downloaded', { version: '1.0.0' })
      return { updateInfo: { version: '1.0.0' } }
    })

    await checkForUpdates()
    expect(intermediateState).toBe('downloading')
  })

  it('sets downloadState to ready after update-downloaded fires (W-4)', async () => {
    // W-4: the event-based wait resolves when update-downloaded fires —
    // no 500ms sleep needed. Test runs without any wall-clock delay.
    mockCheckForUpdates.mockImplementation(async () => {
      await mockAutoUpdater._emit('update-available', { version: '1.0.0' })
      await mockAutoUpdater._emit('update-downloaded', { version: '1.0.0' })
      return { updateInfo: { version: '1.0.0' } }
    })

    const result = await checkForUpdates()
    expect(result.downloadState).toBe('ready')
  })

  it('tracks download progress percentage', async () => {
    const progressValues: number[] = []

    const sink = mock(
      (_channel: string, _meta: unknown, payload: unknown) => {
        if (typeof payload === 'number') {
          progressValues.push(payload)
        }
      },
    )
    setAutoUpdateEventSink(sink as never)

    mockCheckForUpdates.mockImplementation(async () => {
      await mockAutoUpdater._emit('update-available', { version: '1.0.0' })
      await mockAutoUpdater._emit('download-progress', { percent: 42.7 })
      await mockAutoUpdater._emit('download-progress', { percent: 99.1 })
      await mockAutoUpdater._emit('update-downloaded', { version: '1.0.0' })
      return { updateInfo: { version: '1.0.0' } }
    })

    await checkForUpdates()

    // Progress events should broadcast rounded percentage values
    expect(progressValues).toContain(43)
    expect(progressValues).toContain(99)

    setAutoUpdateEventSink(null as never)
  })

  it('does not set error state when update succeeds', async () => {
    mockCheckForUpdates.mockImplementation(async () => {
      await mockAutoUpdater._emit('update-available', { version: '1.0.0' })
      await mockAutoUpdater._emit('update-downloaded', { version: '1.0.0' })
      return { updateInfo: { version: '1.0.0' } }
    })

    const result = await checkForUpdates()
    // downloadState must be 'ready', not 'error' — verifies the success path
    // completed cleanly regardless of any prior test state.
    expect(result.downloadState).toBe('ready')
    expect(result.available).toBe(true)
  })

  it('broadcasts canInstall=true when the downloaded update is ready', async () => {
    const updateBroadcasts: any[] = []
    const sink = mock((channel: string, _meta: unknown, payload: unknown) => {
      if (channel === 'update:available') updateBroadcasts.push(payload)
    })
    setAutoUpdateEventSink(sink as never)

    mockCheckForUpdates.mockImplementation(async () => {
      await mockAutoUpdater._emit('update-available', { version: '1.0.0' })
      await mockAutoUpdater._emit('update-downloaded', { version: '1.0.0' })
      return { updateInfo: { version: '1.0.0' } }
    })

    await checkForUpdates()
    const readyBroadcast = updateBroadcasts.find((payload) => payload?.downloadState === 'ready')
    expect(readyBroadcast).toBeDefined()
    expect(readyBroadcast.canInstall).toBe(true)

    setAutoUpdateEventSink(null as never)
  })
})

describe('installUpdate() — safety guards', () => {
  /**
   * installUpdate() must refuse to call quitAndInstall unless downloadState
   * is 'ready'. This prevents an attacker from triggering an install of a
   * partially-downloaded or unverified file.
   */
  it('throws if no update is ready', async () => {
    // Reset state to idle via a "no update" check
    mockCheckForUpdates.mockImplementation(async () => {
      await mockAutoUpdater._emit('update-not-available', { version: '0.9.2' })
      return { updateInfo: null }
    })
    await checkForUpdates()

    await expect(installUpdate()).rejects.toThrow('No update ready to install')
  })

  it('calls quitAndInstall with correct args when update is ready', async () => {
    // Put state into 'ready'
    mockFsExistsSync.mockImplementation(() => false)
    mockAutoUpdater.downloadedUpdateHelper = null
    mockCheckForUpdates.mockImplementation(async () => {
      await mockAutoUpdater._emit('update-available', { version: '2.0.0' })
      await mockAutoUpdater._emit('update-downloaded', { version: '2.0.0' })
      return { updateInfo: { version: '2.0.0' } }
    })
    await checkForUpdates()

    mockQuitAndInstall.mockClear()
    await installUpdate()

    // isSilent=false, isForceRunAfter=true is the required call signature
    expect(mockQuitAndInstall).toHaveBeenCalledWith(false, true)
  })

  it('sets isUpdating=true during install to prevent force-quit race', async () => {
    // isUpdating() is read by the main process before calling app.exit()
    expect(isUpdating()).toBe(true) // still true from previous test's installUpdate()
  })
})

describe('checkForUpdatesOnLaunch() — dismissed version handling', () => {
  /**
   * checkForUpdatesOnLaunch() wraps checkForUpdates() and must handle the
   * W-2 re-throw gracefully on launch: transient errors return action='none'
   * so the app continues starting normally.
   */
  it('returns action=none when no update is available', async () => {
    mockCheckForUpdates.mockImplementation(async () => {
      await mockAutoUpdater._emit('update-not-available', { version: '0.9.2' })
      return { updateInfo: null }
    })

    const { getDismissedUpdateVersion } = await import('@rox-one/shared/config') as {
      getDismissedUpdateVersion: () => string | null
    }
    ;(getDismissedUpdateVersion as ReturnType<typeof mock>).mockImplementation(() => null)

    const result = await checkForUpdatesOnLaunch()
    expect(result.action).toBe('none')
  })

  it('returns action=skipped when update version was dismissed by user', async () => {
    mockFsExistsSync.mockImplementation(() => false)
    mockAutoUpdater.downloadedUpdateHelper = null
    mockCheckForUpdates.mockImplementation(async () => {
      await mockAutoUpdater._emit('update-available', { version: '1.5.0' })
      await mockAutoUpdater._emit('update-downloaded', { version: '1.5.0' })
      return { updateInfo: { version: '1.5.0' } }
    })

    const { getDismissedUpdateVersion } = await import('@rox-one/shared/config') as {
      getDismissedUpdateVersion: () => string | null
    }
    ;(getDismissedUpdateVersion as ReturnType<typeof mock>).mockImplementation(() => '1.5.0')

    const result = await checkForUpdatesOnLaunch()
    expect(result.action).toBe('skipped')
    expect(result.reason).toBe('dismissed')
    expect(result.version).toBe('1.5.0')
  })

  it('returns action=ready when downloaded update is available and not dismissed', async () => {
    mockFsExistsSync.mockImplementation(() => false)
    mockAutoUpdater.downloadedUpdateHelper = null
    mockCheckForUpdates.mockImplementation(async () => {
      await mockAutoUpdater._emit('update-available', { version: '1.5.0' })
      await mockAutoUpdater._emit('update-downloaded', { version: '1.5.0' })
      return { updateInfo: { version: '1.5.0' } }
    })

    const { getDismissedUpdateVersion } = await import('@rox-one/shared/config') as {
      getDismissedUpdateVersion: () => string | null
    }
    ;(getDismissedUpdateVersion as ReturnType<typeof mock>).mockImplementation(() => null)

    const result = await checkForUpdatesOnLaunch()
    expect(result.action).toBe('ready')
    expect(result.version).toBe('1.5.0')
  })

  it('returns action=none when checkForUpdates throws on launch (W-2 graceful handling)', async () => {
    // W-2: checkForUpdates() now re-throws on error; checkForUpdatesOnLaunch()
    // must catch and return action='none' so the app continues starting.
    mockCheckForUpdates.mockImplementation(async () => {
      throw new Error('ECONNREFUSED: connect ECONNREFUSED 127.0.0.1:443')
    })

    const result = await checkForUpdatesOnLaunch()
    expect(result.action).toBe('none')
    expect(result.reason).toBe('check-failed')
  })
})

describe('dev runtime guard', () => {
  it('skips the update check entirely when ROX_ELECTRON_DEV_RUNTIME=1', async () => {
    const original = process.env.ROX_ELECTRON_DEV_RUNTIME
    process.env.ROX_ELECTRON_DEV_RUNTIME = '1'

    mockCheckForUpdates.mockClear()
    const result = await checkForUpdates()

    expect(mockCheckForUpdates).not.toHaveBeenCalled()
    expect(result.available).toBe(false)
    expect(result.downloadState).toBe('idle')

    process.env.ROX_ELECTRON_DEV_RUNTIME = original
  })

  it('skips the update check entirely when ROX_E2E=1', async () => {
    const original = process.env.ROX_E2E
    process.env.ROX_E2E = '1'

    try {
      mockCheckForUpdates.mockClear()
      const result = await checkForUpdates()

      expect(mockCheckForUpdates).not.toHaveBeenCalled()
      expect(result.available).toBe(false)
      expect(result.downloadState).toBe('idle')
    } finally {
      if (original === undefined) {
        delete process.env.ROX_E2E
      } else {
        process.env.ROX_E2E = original
      }
    }
  })
})
