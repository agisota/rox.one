/**
 * Auto-update module using electron-updater
 *
 * Handles checking for updates, downloading, and installing via the standard
 * electron-updater library. Updates are served from https://app.rox.one/electron/latest
 * using the generic provider (YAML manifests + binaries on R2/S3).
 *
 * Platform behavior:
 * - macOS: Downloads zip, extracts and swaps app bundle atomically
 * - Windows: Downloads NSIS installer, runs silently on quit
 * - Linux: Downloads AppImage, replaces current file
 *
 * All platforms support download-progress events (electron-updater v6.8.0+).
 * quitAndInstall() handles restart natively — no external scripts.
 */

import { autoUpdater } from 'electron-updater'
import { app } from 'electron'
import { platform } from 'os'
import * as path from 'path'
import * as fs from 'fs'
import * as semver from 'semver'
import { mainLog } from './logger'
import { getAppVersion } from '@rox-one/shared/version'
import {
  getDismissedUpdateVersion,
  clearDismissedUpdateVersion,
  getAutoDownloadUpdates,
  setAutoDownloadUpdates,
  getUpdateChannel,
  setUpdateChannel,
} from '@rox-one/shared/config'
import { readJsonFileSync } from '@rox-one/shared/utils/files'
import { RPC_CHANNELS, type UpdateChannel, type UpdateInfo, type UpdateSettings } from '../shared/types'
import type { EventSink } from '@rox-one/server-core/transport'

// Platform detection
const PLATFORM = platform()
const IS_MAC = PLATFORM === 'darwin'
const IS_WINDOWS = PLATFORM === 'win32'

// Get the update cache directory path (for file watcher fallback on macOS)
// electron-updater uses these paths:
// - Windows: %LOCALAPPDATA%/{appName}-updater/pending
// - macOS: ~/Library/Caches/{appName}-updater/pending
// - Linux: ~/.cache/{appName}-updater/pending
function getUpdateCacheDir(): string {
  const appName = app.getName()
  if (IS_MAC) {
    return path.join(app.getPath('home'), 'Library', 'Caches', `${appName}-updater`, 'pending')
  } else if (IS_WINDOWS) {
    // Windows uses LOCALAPPDATA, not APPDATA (roaming)
    const localAppData = process.env.LOCALAPPDATA || path.join(app.getPath('home'), 'AppData', 'Local')
    return path.join(localAppData, `${appName}-updater`, 'pending')
  } else {
    // Linux
    return path.join(app.getPath('home'), '.cache', `${appName}-updater`, 'pending')
  }
}

const UPDATE_FEED_ROOT = 'https://app.rox.one/electron'

function getReleaseNotesUrl(channel: UpdateChannel): string {
  return `${UPDATE_FEED_ROOT}/${channel}/release-notes.json`
}

function getManualDownloadUrl(channel: UpdateChannel, version: string | null): string | null {
  const channelOrVersion = version ? version.replace(/^v/, '') : channel
  const base = `${UPDATE_FEED_ROOT}/${channelOrVersion}`
  if (IS_MAC) {
    return `${base}/ROX-ONE-${process.arch === 'arm64' ? 'arm64' : 'x64'}.dmg`
  }
  if (IS_WINDOWS) {
    return `${base}/ROX-ONE-x64.exe`
  }
  return `${base}/ROX-ONE-x86_64.AppImage`
}


function normalizeUpdateChannelSetting(value: unknown, fallback: UpdateChannel = 'stable'): UpdateChannel {
  if (value === 'beta') return 'beta'
  if (value === 'stable') return 'stable'
  return fallback
}

function normalizeAutoDownloadSetting(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function currentUpdateSettings(): UpdateSettings {
  return {
    autoDownloadUpdates: getAutoDownloadUpdates(),
    updateChannel: getUpdateChannel(),
  }
}

function makeUpdateInfo(overrides: Partial<UpdateInfo> = {}): UpdateInfo {
  const settings = currentUpdateSettings()
  const latestVersion = overrides.latestVersion ?? null
  const channel = overrides.channel ?? settings.updateChannel
  const downloadState = overrides.downloadState ?? 'idle'
  return {
    available: false,
    currentVersion: getAppVersion(),
    latestVersion,
    downloadState,
    downloadProgress: 0,
    channel,
    autoDownload: settings.autoDownloadUpdates,
    canInstall: downloadState === 'ready',
    manualDownloadUrl: getManualDownloadUrl(channel, latestVersion),
    releaseNotesUrl: getReleaseNotesUrl(channel),
    ...overrides,
  }
}

function refreshDerivedUpdateInfoFields(info: UpdateInfo): UpdateInfo {
  const settings = currentUpdateSettings()
  const channel = info.channel ?? settings.updateChannel
  return {
    ...info,
    currentVersion: getAppVersion(),
    channel,
    autoDownload: settings.autoDownloadUpdates,
    canInstall: info.downloadState === 'ready',
    manualDownloadUrl: getManualDownloadUrl(channel, info.latestVersion),
    releaseNotesUrl: getReleaseNotesUrl(channel),
  }
}

// Module state — keeps track of update info for IPC queries
let updateInfo: UpdateInfo = makeUpdateInfo()

let eventSink: EventSink | null = null

// Flag to indicate update is in progress — used to prevent force exit during quitAndInstall
let __isUpdating = false

// W-1/W-2: Tracks the last error emitted by the autoUpdater 'error' event so
// checkForUpdates() can detect it and re-throw rather than swallowing silently.
let __pendingUpdaterError: Error | null = null

// W-4: Resolvers for event-based waiting in checkForUpdates(). Populated by
// update-available / update-not-available / update-downloaded / error handlers
// and consumed once by the current checkForUpdates() call.
let __updateEventResolvers: Array<() => void> = []

function __resolveUpdateEvent(): void {
  const resolvers = __updateEventResolvers.splice(0)
  for (const resolve of resolvers) resolve()
}

function isDevRuntimeUpdateDisabled(): boolean {
  return process.env.ROX_ELECTRON_DEV_RUNTIME === '1'
}

/**
 * Check if an update installation is in progress.
 * Used by main process to avoid force-quitting during update.
 */
export function isUpdating(): boolean {
  return __isUpdating
}

/**
 * Set the event sink for broadcasting update events to renderer windows
 */
export function setAutoUpdateEventSink(sink: EventSink): void {
  eventSink = sink
}

/**
 * Get current update info (called by IPC handler)
 */
export function getUpdateInfo(): UpdateInfo {
  updateInfo = refreshDerivedUpdateInfoFields(updateInfo)
  return { ...updateInfo }
}

function configureUpdateFeed(settings: UpdateSettings = currentUpdateSettings()): void {
  const channel = settings.updateChannel
  const feedChannel = channel === 'beta' ? 'beta' : 'latest'
  autoUpdater.autoDownload = settings.autoDownloadUpdates
  autoUpdater.allowPrerelease = channel === 'beta'
  autoUpdater.allowDowngrade = false
  try {
    autoUpdater.setFeedURL({
      provider: 'generic',
      url: `${UPDATE_FEED_ROOT}/${channel}/`,
      channel: feedChannel,
    })
  } catch (error) {
    mainLog.warn('[auto-update] Failed to configure update feed:', error)
  }
  updateInfo = refreshDerivedUpdateInfoFields({
    ...updateInfo,
    channel,
    autoDownload: settings.autoDownloadUpdates,
    releaseNotesUrl: getReleaseNotesUrl(channel),
  })
}

export function getUpdateSettings(): UpdateSettings {
  const settings = currentUpdateSettings()
  configureUpdateFeed(settings)
  return settings
}

export function setUpdateSettings(settings: Partial<UpdateSettings>): UpdateSettings {
  const current = currentUpdateSettings()
  const next: UpdateSettings = {
    autoDownloadUpdates: normalizeAutoDownloadSetting(settings.autoDownloadUpdates, current.autoDownloadUpdates),
    updateChannel: normalizeUpdateChannelSetting(settings.updateChannel, current.updateChannel),
  }

  if (typeof settings.autoDownloadUpdates === 'boolean') {
    setAutoDownloadUpdates(next.autoDownloadUpdates)
  } else if (settings.autoDownloadUpdates !== undefined) {
    mainLog.warn('[auto-update] Ignoring invalid autoDownloadUpdates setting:', settings.autoDownloadUpdates)
  }
  if (settings.updateChannel === 'stable' || settings.updateChannel === 'beta') {
    setUpdateChannel(next.updateChannel)
  } else if (settings.updateChannel !== undefined) {
    mainLog.warn('[auto-update] Ignoring invalid updateChannel setting:', settings.updateChannel)
  }

  configureUpdateFeed(next)
  updateInfo = makeUpdateInfo({
    ...updateInfo,
    channel: next.updateChannel,
    autoDownload: next.autoDownloadUpdates,
    downloadState: updateInfo.downloadState === 'error' ? 'idle' : updateInfo.downloadState,
    error: undefined,
  })
  broadcastUpdateInfo()
  return next
}

/**
 * Broadcast update info to all renderer windows.
 * Creates a snapshot to avoid race conditions during broadcast.
 */
function broadcastUpdateInfo(): void {
  if (!eventSink) return

  const snapshot = { ...updateInfo }
  eventSink(RPC_CHANNELS.update.AVAILABLE, { to: 'all' }, snapshot)
}

/**
 * Broadcast download progress to all renderer windows.
 */
function broadcastDownloadProgress(progress: number): void {
  if (!eventSink) return

  eventSink(RPC_CHANNELS.update.DOWNLOAD_PROGRESS, { to: 'all' }, progress)
}

// ─── Configure electron-updater ───────────────────────────────────────────────

// Install on app quit (if update is downloaded but user hasn't clicked "Restart")
autoUpdater.autoInstallOnAppQuit = true

// Use the logger for electron-updater internal logging
autoUpdater.logger = {
  info: (msg: unknown) => mainLog.info('[electron-updater]', msg),
  warn: (msg: unknown) => mainLog.warn('[electron-updater]', msg),
  error: (msg: unknown) => mainLog.error('[electron-updater]', msg),
  debug: (msg: unknown) => mainLog.info('[electron-updater:debug]', msg),
}

// Apply persisted channel + auto-download settings at module load.
configureUpdateFeed()

// ─── Event handlers ───────────────────────────────────────────────────────────

autoUpdater.on('checking-for-update', () => {
  mainLog.info('[auto-update] Checking for updates...')
})

autoUpdater.on('update-available', (info) => {
  mainLog.info(`[auto-update] Update available: ${updateInfo.currentVersion} → ${info.version}`)

  // W-3: Independent downgrade guard — do not rely solely on electron-updater's
  // semver comparison. If the incoming version is not strictly greater than the
  // current version, refuse the update and log a warning so ops can detect
  // a potential version-rollback / downgrade attack.
  const current = getAppVersion()
  if (!semver.valid(info.version) || !semver.gt(info.version, current)) {
    mainLog.warn(
      `[auto-update] DOWNGRADE BLOCKED: remote version ${info.version} is not newer than current ${current}. Refusing update.`,
    )
    updateInfo = refreshDerivedUpdateInfoFields({
      ...updateInfo,
      available: false,
      latestVersion: info.version,
      downloadState: 'idle',
    })
    broadcastUpdateInfo()
    __resolveUpdateEvent()
    return
  }

  // First, check electron-updater's internal state (most reliable)
  const internalState = checkElectronUpdaterState()
  if (internalState.ready) {
    mainLog.info(`[auto-update] electron-updater reports download ready`)
    updateInfo = refreshDerivedUpdateInfoFields({
      ...updateInfo,
      available: true,
      latestVersion: info.version,
      downloadState: 'ready',
      downloadProgress: 100,
    })
    broadcastUpdateInfo()
    __resolveUpdateEvent()
    return
  }

  // Fallback: check if file exists in cache directory
  const existing = checkForExistingDownload()
  if (existing.exists) {
    mainLog.info(`[auto-update] Update already downloaded (file check), setting state to ready`)
    updateInfo = refreshDerivedUpdateInfoFields({
      ...updateInfo,
      available: true,
      latestVersion: info.version,
      downloadState: 'ready',
      downloadProgress: 100,
    })
    broadcastUpdateInfo()
    __resolveUpdateEvent()
    return
  }

  const nextState = autoUpdater.autoDownload ? 'downloading' : 'idle'
  updateInfo = refreshDerivedUpdateInfoFields({
    ...updateInfo,
    available: true,
    latestVersion: info.version,
    downloadState: nextState,
    downloadProgress: 0,
    error: undefined,
  })
  broadcastUpdateInfo()
  if (!autoUpdater.autoDownload) {
    __resolveUpdateEvent()
    return
  }
  // Do NOT resolve here — wait for update-downloaded or error to signal completion
})

autoUpdater.on('update-not-available', (info) => {
  mainLog.info(`[auto-update] Already up to date (${info.version})`)

  updateInfo = refreshDerivedUpdateInfoFields({
    ...updateInfo,
    available: false,
    latestVersion: info.version,
    downloadState: 'idle',
  })
  broadcastUpdateInfo()
  // W-4: signal checkForUpdates() that we have a definitive answer
  __resolveUpdateEvent()
})

autoUpdater.on('download-progress', (progress) => {
  const percent = Math.round(progress.percent)
  updateInfo = refreshDerivedUpdateInfoFields({ ...updateInfo, downloadState: 'downloading', downloadProgress: percent })
  broadcastDownloadProgress(percent)
})

autoUpdater.on('update-downloaded', async (info) => {
  mainLog.info(`[auto-update] Update downloaded: v${info.version}`)

  updateInfo = refreshDerivedUpdateInfoFields({
    ...updateInfo,
    available: true,
    latestVersion: info.version,
    downloadState: 'ready',
    downloadProgress: 100,
  })
  broadcastUpdateInfo()
  // W-4: signal checkForUpdates() that we have a definitive answer
  __resolveUpdateEvent()

  // Rebuild menu to show "Install Update..." option
  const { rebuildMenu } = await import('./menu')
  rebuildMenu()
})

autoUpdater.on('error', (error) => {
  // W-1: Always log to mainLog regardless of whether an EventSink is connected.
  // This ensures cert-chain attacks and signature failures surface in ops logs
  // even when no renderer window is listening.
  mainLog.error('[auto-update] Error:', error.message)

  updateInfo = refreshDerivedUpdateInfoFields({
    ...updateInfo,
    available: false,
    downloadState: 'error',
    error: error.message,
  })

  // Broadcast to renderer if a sink is connected; the log above is the fallback.
  broadcastUpdateInfo()

  // W-2: Store the error so checkForUpdates() can detect and re-throw it,
  // enabling callers to use try/catch rather than inspecting UpdateInfo.downloadState.
  __pendingUpdaterError = error instanceof Error ? error : new Error(String(error))

  // W-4: Unblock the event-based wait in checkForUpdates()
  __resolveUpdateEvent()
})

// ─── Exported API ─────────────────────────────────────────────────────────────

/**
 * Check if electron-updater already has a validated download ready.
 * This uses electron-updater's internal state which is more reliable than file checks.
 */
function checkElectronUpdaterState(): { ready: boolean; version?: string } {
  try {
    // Access electron-updater's internal downloadedUpdateHelper
    // @ts-expect-error - accessing internal API for reliability
    const helper = autoUpdater.downloadedUpdateHelper
    if (helper) {
      mainLog.info(`[auto-update] downloadedUpdateHelper exists, cacheDir: ${helper.cacheDir}`)
      // @ts-expect-error - accessing internal API
      const versionInfo = helper.versionInfo
      if (versionInfo) {
        mainLog.info(`[auto-update] electron-updater has validated download: ${JSON.stringify(versionInfo)}`)
        return { ready: true, version: versionInfo.version }
      }
    }
  } catch (error) {
    mainLog.warn('[auto-update] Error checking electron-updater state:', error)
  }
  return { ready: false }
}

/**
 * Options for checkForUpdates
 */
interface CheckOptions {
  /** If true, automatically start download when update is found (default: true) */
  autoDownload?: boolean
}

/**
 * Check if a downloaded update already exists in the cache directory.
 * This helps detect updates that were downloaded in a previous session.
 */
function checkForExistingDownload(): { exists: boolean; version?: string } {
  try {
    const cacheDir = getUpdateCacheDir()
    mainLog.info(`[auto-update] Checking cache directory: ${cacheDir}`)

    if (!fs.existsSync(cacheDir)) {
      mainLog.info(`[auto-update] Cache directory does not exist`)
      return { exists: false }
    }

    const files = fs.readdirSync(cacheDir)
    mainLog.info(`[auto-update] Files in cache: ${JSON.stringify(files)}`)

    // Look for update info file that electron-updater creates
    const updateInfoFile = files.find(f => f === 'update-info.json')
    if (updateInfoFile) {
      const infoPath = path.join(cacheDir, updateInfoFile)
      const info = readJsonFileSync(infoPath) as Record<string, unknown> | null
      mainLog.info(`[auto-update] update-info.json contents: ${JSON.stringify(info)}`)

      // electron-updater uses 'fileName' (not 'path') in update-info.json
      const fileName = (info?.fileName || info?.path) as string | undefined
      if (fileName && fs.existsSync(path.join(cacheDir, fileName))) {
        mainLog.info(`[auto-update] Found existing download via update-info.json: ${fileName}`)
        return { exists: true, version: info?.version as string }
      }
    }

    // Fallback: check for any installer/zip/dmg file
    const downloadFile = files.find(f =>
      f.endsWith('.zip') ||
      f.endsWith('.exe') ||
      f.endsWith('.AppImage') ||
      f.endsWith('.dmg') ||
      f.endsWith('.nupkg')
    )
    if (downloadFile) {
      mainLog.info(`[auto-update] Found existing download file: ${downloadFile}`)
      return { exists: true }
    }

    mainLog.info(`[auto-update] No existing download found in cache`)
    return { exists: false }
  } catch (error) {
    mainLog.warn('[auto-update] Error checking for existing download:', error)
    return { exists: false }
  }
}

/**
 * Check for available updates.
 * Returns the current UpdateInfo state after check completes.
 *
 * @param options.autoDownload - If false, only checks without downloading (for manual "Check Now")
 * @throws when electron-updater emits an error or the network request fails (W-2)
 */
export async function checkForUpdates(options: CheckOptions = {}): Promise<UpdateInfo> {
  configureUpdateFeed()
  const { autoDownload = getAutoDownloadUpdates() } = options

  if (isDevRuntimeUpdateDisabled()) {
    mainLog.info('[auto-update] Skipping update check in Electron dev runtime')
    updateInfo = refreshDerivedUpdateInfoFields({
      ...updateInfo,
      available: false,
      downloadState: 'idle',
      error: undefined,
    })
    return getUpdateInfo()
  }

  // Temporarily override autoDownload for this check if needed
  // (e.g., manual check from settings shouldn't auto-download on metered connections)
  const previousAutoDownload = autoUpdater.autoDownload
  autoUpdater.autoDownload = autoDownload

  // W-2: clear any stale error from a previous check
  __pendingUpdaterError = null

  try {
    // W-4: Set up event-based waiting before calling checkForUpdates() so we
    // never miss an event that fires synchronously inside the call.
    // The promise resolves when update-available (already-downloaded/blocked),
    // update-not-available, update-downloaded, or error fires.
    const EVENT_WAIT_TIMEOUT_MS = 30_000
    const eventSettled = new Promise<void>((resolve) => {
      __updateEventResolvers.push(resolve)
    })

    // Check for updates - this returns a promise that resolves with the check result
    const result = await autoUpdater.checkForUpdates()

    if (result?.updateInfo) {
      // W-4: Wait for the definitive event (update-downloaded / error / not-available)
      // instead of a fixed 500 ms wall-clock sleep.
      await Promise.race([
        eventSettled,
        new Promise<void>((resolve) => setTimeout(resolve, EVENT_WAIT_TIMEOUT_MS)),
      ])

      // Double-check: if we're still showing 'downloading' but file exists, update state
      if (updateInfo.downloadState === 'downloading') {
        const existing = checkForExistingDownload()
        if (existing.exists) {
          mainLog.info('[auto-update] Update already downloaded, updating state to ready')
          updateInfo = refreshDerivedUpdateInfoFields({
            ...updateInfo,
            downloadState: 'ready',
            downloadProgress: 100,
          })
          broadcastUpdateInfo()
        }
      }
    }

    // W-2: If the autoUpdater emitted an error event during the check, re-throw
    // so callers can use try/catch instead of inspecting UpdateInfo.downloadState.
    if (__pendingUpdaterError) {
      const err = __pendingUpdaterError
      __pendingUpdaterError = null
      throw err
    }
  } catch (error) {
    mainLog.error('[auto-update] Check failed:', error)
    updateInfo = refreshDerivedUpdateInfoFields({
      ...updateInfo,
      downloadState: 'error',
      error: error instanceof Error ? error.message : 'Check failed',
    })
    // W-2: re-throw so callers can distinguish success from failure via try/catch
    throw error
  } finally {
    // Restore previous autoDownload setting
    autoUpdater.autoDownload = previousAutoDownload
    // Clean up any unused resolver (e.g., when result?.updateInfo was null)
    __updateEventResolvers.length = 0
  }

  return getUpdateInfo()
}


/**
 * Explicitly download an already-detected update.
 * Used when auto-download is disabled and the user clicks "Download update".
 */
export async function downloadUpdate(): Promise<UpdateInfo> {
  configureUpdateFeed()
  if (isDevRuntimeUpdateDisabled()) {
    mainLog.info('[auto-update] Skipping update download in Electron dev runtime')
    return getUpdateInfo()
  }
  try {
    updateInfo = refreshDerivedUpdateInfoFields({
      ...updateInfo,
      downloadState: 'downloading',
      downloadProgress: updateInfo.downloadProgress || 0,
      error: undefined,
    })
    broadcastUpdateInfo()
    await autoUpdater.downloadUpdate()
    return getUpdateInfo()
  } catch (error) {
    mainLog.error('[auto-update] Download failed:', error)
    updateInfo = refreshDerivedUpdateInfoFields({
      ...updateInfo,
      downloadState: 'error',
      error: error instanceof Error ? error.message : 'Download failed',
    })
    broadcastUpdateInfo()
    throw error
  }
}

/**
 * Install the downloaded update and restart the app.
 * Calls electron-updater's quitAndInstall which handles:
 * - macOS: Extracts zip and swaps app bundle
 * - Windows: Runs NSIS installer silently
 * - Linux: Replaces AppImage file
 * Then relaunches the app automatically.
 */
export async function installUpdate(): Promise<void> {
  if (updateInfo.downloadState !== 'ready') {
    throw new Error('No update ready to install')
  }

  mainLog.info('[auto-update] Installing update and restarting...')

  updateInfo = refreshDerivedUpdateInfoFields({ ...updateInfo, downloadState: 'installing' })
  broadcastUpdateInfo()

  // Clear dismissed version since user is explicitly updating
  clearDismissedUpdateVersion()

  // Set flag to prevent force exit from breaking electron-updater's shutdown sequence
  __isUpdating = true

  try {
    // isSilent=false shows the installer UI on Windows if needed (fallback)
    // isForceRunAfter=true ensures the app relaunches after install
    autoUpdater.quitAndInstall(false, true)
  } catch (error) {
    __isUpdating = false
    mainLog.error('[auto-update] quitAndInstall failed:', error)
    updateInfo = refreshDerivedUpdateInfoFields({ ...updateInfo, downloadState: 'error' })
    broadcastUpdateInfo()
    throw error
  }
}

/**
 * Result of update check on launch
 */
export interface UpdateOnLaunchResult {
  action: 'none' | 'skipped' | 'ready' | 'downloading'
  reason?: string
  version?: string | null
}

/**
 * Check for updates on app launch.
 * - Checks immediately (no delay)
 * - Respects dismissed version (skips notification but allows manual check)
 * - Auto-downloads if update available
 */
export async function checkForUpdatesOnLaunch(): Promise<UpdateOnLaunchResult> {
  mainLog.info('[auto-update] Checking for updates on launch...')

  let info: UpdateInfo
  try {
    info = await checkForUpdates({ autoDownload: getAutoDownloadUpdates() })
  } catch {
    // checkForUpdates() now re-throws on error (W-2). On launch, a transient
    // network failure or signature error should not crash the app — log and
    // treat as no update so the app continues starting normally.
    mainLog.warn('[auto-update] checkForUpdatesOnLaunch: check failed, continuing without update')
    return { action: 'none', reason: 'check-failed' }
  }

  if (!info.available) {
    return { action: 'none' }
  }

  // Check if this version was dismissed by user
  const dismissedVersion = getDismissedUpdateVersion()
  if (dismissedVersion === info.latestVersion) {
    mainLog.info(`[auto-update] Update ${info.latestVersion} was dismissed, skipping notification`)
    return { action: 'skipped', reason: 'dismissed', version: info.latestVersion }
  }

  if (info.downloadState === 'ready') {
    return { action: 'ready', version: info.latestVersion }
  }

  // Download in progress — will notify when ready via update-downloaded event
  return { action: 'downloading', version: info.latestVersion }
}
