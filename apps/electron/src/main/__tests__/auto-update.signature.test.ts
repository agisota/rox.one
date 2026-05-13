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
 *   W-1: autoUpdater.error event handler sets downloadState='error' but does
 *        NOT re-throw or propagate — a silent swallow when no broadcastUpdateInfo
 *        recipient is connected.
 *   W-2: checkForUpdates() catches errors and sets error state but returns
 *        normally (no throw), so callers cannot distinguish success from failure
 *        without inspecting the returned UpdateInfo.downloadState.
 *   W-3: Downgrade protection is entirely delegated to electron-updater's
 *        semver comparison; there is no independent version guard in this
 *        module — if electron-updater's comparison is bypassed the module
 *        would accept a downgrade silently.
 *   W-4: The 500ms setTimeout in checkForUpdates() is an implicit timing
 *        assumption that could race under high load, leaving state as
 *        'downloading' when the file already exists.
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test'

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

mock.module('electron', () => ({
  app: {
    getName: mock(() => 'rox-one'),
    getPath: mock((name: string) => `/tmp/mock-${name}`),
  },
  ipcMain: {
    handle: mock(() => {}),
  },
}))

// ─── Mock shared modules ───────────────────────────────────────────────────────

mock.module('@rox-one/shared/version', () => ({
  getAppVersion: mock(() => '0.9.2'),
  APP_VERSION: '0.9.2',
}))

mock.module('@rox-one/shared/config', () => ({
  getDismissedUpdateVersion: mock(() => null),
  clearDismissedUpdateVersion: mock(() => {}),
}))

mock.module('@rox-one/shared/utils/files', () => ({
  readJsonFileSync: mock(() => null),
}))

// ─── Mock menu (async import inside update-downloaded handler) ────────────────

mock.module('../menu', () => ({
  rebuildMenu: mock(() => {}),
}))

// ─── Mock fs (used by checkForExistingDownload) ────────────────────────────────

const mockFsExistsSync = mock((_path: string) => false)
const mockFsReaddirSync = mock((_path: string) => [] as string[])

mock.module('fs', () => ({
  existsSync: mockFsExistsSync,
  readdirSync: mockFsReaddirSync,
}))

// ─── Mock path (used by getUpdateCacheDir) ─────────────────────────────────────

mock.module('path', () => ({
  join: (...parts: string[]) => parts.join('/'),
}))

// ─── Mock os ──────────────────────────────────────────────────────────────────

mock.module('os', () => ({
  platform: mock(() => 'linux'),
}))

// ─── electron-updater mock — the heart of these tests ─────────────────────────
// electron-updater's autoUpdater is the security boundary. We assert:
//   a) our module correctly configures it (logger, autoDownload, etc.)
//   b) our event handlers respond correctly to the events it emits
//   c) checkForUpdates() propagates errors rather than swallowing them silently

type EventHandler = (...args: unknown[]) => void | Promise<void>
const autoUpdaterListeners: Record<string, EventHandler[]> = {}

// Tracks calls made to the mocked autoUpdater
const mockCheckForUpdates = mock(async () => ({ updateInfo: null }))
const mockQuitAndInstall = mock((_isSilent: boolean, _isForceRunAfter: boolean) => {})

const mockAutoUpdater = {
  autoDownload: true,
  autoInstallOnAppQuit: true,
  logger: null as unknown,
  downloadedUpdateHelper: null as unknown,

  on: (event: string, handler: EventHandler) => {
    if (!autoUpdaterListeners[event]) autoUpdaterListeners[event] = []
    autoUpdaterListeners[event].push(handler)
  },

  checkForUpdates: mockCheckForUpdates,
  quitAndInstall: mockQuitAndInstall,

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

function resetAutoUpdaterListeners() {
  for (const key of Object.keys(autoUpdaterListeners)) {
    delete autoUpdaterListeners[key]
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('auto-update module configuration', () => {
  it('configures autoDownload=true on module load', () => {
    // The module sets autoDownload=true at import time (line 119 of source)
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

describe('Scenario 1: Signature mismatch is rejected', () => {
  /**
   * electron-updater fires the 'error' event when signature validation fails.
   * Our error handler MUST:
   *   - log the error (so ops teams can detect cert-chain attacks)
   *   - set downloadState to 'error' (NOT 'ready' or 'downloading')
   *   - NOT set available=true
   *
   * WEAKNESS W-1: The error is logged but not re-thrown — callers that don't
   * inspect UpdateInfo.downloadState will miss the failure.
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

  it('sets downloadState to error when signature verification fails', async () => {
    const result = await checkForUpdates()
    expect(result.downloadState).toBe('error')
  })

  it('does not mark update as available when signature fails', async () => {
    const result = await checkForUpdates()
    expect(result.available).toBe(false)
  })

  it('logs the signature error at error level', async () => {
    await checkForUpdates()
    const hasError = hasLogMatching('error', 'Error')
    expect(hasError).toBe(true)
  })

  it('stores the error message in UpdateInfo', async () => {
    const result = await checkForUpdates()
    expect(result.error).toBeDefined()
    expect(typeof result.error).toBe('string')
  })

  it('does not call quitAndInstall after a signature error', async () => {
    mockQuitAndInstall.mockClear()
    await checkForUpdates()
    expect(mockQuitAndInstall).not.toHaveBeenCalled()
  })
})

describe('Scenario 2: Stale-version downgrade is blocked', () => {
  /**
   * electron-updater fires 'update-not-available' when the remote version
   * is <= the current version (semver comparison). Our handler MUST set
   * available=false so the UI never offers a downgrade install.
   *
   * Current version: 0.9.2 (set in @rox-one/shared/version mock above)
   * Remote manifest: version 0.1.0 (older)
   *
   * WEAKNESS W-3: This module has no independent version guard; it trusts
   * electron-updater entirely. If the library's comparison is bypassed
   * (e.g., via a forged update-available event), the module would accept it.
   */
  beforeEach(() => {
    clearLogCalls()
    mockCheckForUpdates.mockImplementation(async () => {
      // electron-updater emits update-not-available when remote version ≤ current
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

describe('Scenario 3: Network failure handling', () => {
  /**
   * When the update server is unreachable or returns a non-200, electron-updater
   * rejects the checkForUpdates() promise. Our module MUST:
   *   - catch the rejection (no unhandled promise rejection / crash)
   *   - set downloadState to 'error'
   *   - set a human-readable error message
   *   - log the failure
   *
   * WEAKNESS W-2: checkForUpdates() does NOT re-throw after catching the
   * network error, so callers cannot use try/catch — they must inspect the
   * returned UpdateInfo.downloadState instead.
   */
  beforeEach(() => {
    clearLogCalls()
    mockCheckForUpdates.mockImplementation(async () => {
      throw new Error('ECONNREFUSED: connect ECONNREFUSED 127.0.0.1:443')
    })
  })

  it('does not crash when the update server is unreachable', async () => {
    // Must resolve (not reject) — no crash
    const result = await checkForUpdates()
    expect(result).toBeDefined()
  })

  it('sets downloadState to error on network failure', async () => {
    const result = await checkForUpdates()
    expect(result.downloadState).toBe('error')
  })

  it('populates UpdateInfo.error with the failure reason', async () => {
    const result = await checkForUpdates()
    expect(result.error).toContain('ECONNREFUSED')
  })

  it('logs the network failure at error level', async () => {
    await checkForUpdates()
    const hasError = hasLogMatching('error', 'Check failed')
    expect(hasError).toBe(true)
  })

  it('does not mark an update as available after a network failure', async () => {
    const result = await checkForUpdates()
    expect(result.available).toBe(false)
  })

  it('does not call quitAndInstall after a network failure', async () => {
    mockQuitAndInstall.mockClear()
    await checkForUpdates()
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
      return { updateInfo: { version: '1.0.0' } }
    })

    const result = await checkForUpdates()
    expect(result.available).toBe(true)
  })

  it('records the new version in latestVersion', async () => {
    mockCheckForUpdates.mockImplementation(async () => {
      await mockAutoUpdater._emit('update-available', { version: '1.0.0' })
      return { updateInfo: { version: '1.0.0' } }
    })

    const result = await checkForUpdates()
    expect(result.latestVersion).toBe('1.0.0')
  })

  it('sets downloadState to downloading while update downloads', async () => {
    mockCheckForUpdates.mockImplementation(async () => {
      await mockAutoUpdater._emit('update-available', { version: '1.0.0' })
      return { updateInfo: { version: '1.0.0' } }
    })

    const result = await checkForUpdates()
    // autoDownload=true → state should be 'downloading' (no file in cache yet)
    expect(result.downloadState).toBe('downloading')
  })

  it('sets downloadState to ready after update-downloaded fires', async () => {
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
})
