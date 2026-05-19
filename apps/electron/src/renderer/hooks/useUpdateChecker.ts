/**
 * Update Checker Hook
 *
 * Manages auto-update state for the Electron app.
 * - Listens for update availability broadcasts from main process
 * - Tracks download progress
 * - Provides methods to check for updates and install
 * - Shows toast notification when update is ready
 * - Persistent dismissal across app restarts (per version)
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import type { UpdateInfo, UpdateSettings } from '../../shared/types'

interface UseUpdateCheckerResult {
  /** Current update info */
  updateInfo: UpdateInfo | null
  /** Whether an update is available */
  updateAvailable: boolean
  /** Whether update is currently downloading */
  isDownloading: boolean
  /** Whether update is ready to install */
  isReadyToInstall: boolean
  /** Download progress (0-100) */
  downloadProgress: number
  /** Current persisted update settings */
  updateSettings: UpdateSettings | null
  /** Check for updates manually */
  checkForUpdates: () => Promise<void>
  /** Download an already-detected update */
  downloadUpdate: () => Promise<void>
  /** Install the downloaded update and restart */
  installUpdate: () => Promise<void>
  /** Refresh persisted update settings */
  refreshSettings: () => Promise<UpdateSettings | null>
  /** Persist update settings */
  setUpdateSettings: (settings: Partial<UpdateSettings>) => Promise<UpdateSettings | null>
}

// Toast ID for update notification (allows dismiss/update)
const UPDATE_TOAST_ID = 'update-available'

export function useUpdateChecker(): UseUpdateCheckerResult {
  const { t } = useTranslation()
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)
  const [updateSettings, setUpdateSettingsState] = useState<UpdateSettings | null>(null)
  // Track if we've shown the toast for this version to avoid duplicates
  const shownToastVersionRef = useRef<string | null>(null)

  // Show toast notification when update is ready
  const refreshSettings = useCallback(async () => {
    try {
      const settings = await window.electronAPI.getUpdateSettings()
      setUpdateSettingsState(settings)
      return settings
    } catch (error) {
      console.error('[useUpdateChecker] Failed to load update settings:', error)
      return null
    }
  }, [])

  const setUpdateSettings = useCallback(async (settings: Partial<UpdateSettings>) => {
    try {
      const next = await window.electronAPI.setUpdateSettings(settings)
      setUpdateSettingsState(next)
      const info = await window.electronAPI.getUpdateInfo()
      setUpdateInfo(info)
      return next
    } catch (error) {
      console.error('[useUpdateChecker] Failed to save update settings:', error)
      toast.error(t('toast.failedToSaveUpdateSettings'), {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
      return null
    }
  }, [t])

  const showUpdateToast = useCallback((version: string, onInstall: () => void) => {
    // Don't show if already shown for this version in this session
    if (shownToastVersionRef.current === version) {
      return
    }
    shownToastVersionRef.current = version

    toast.info(t('toast.updateReady', { version }), {
      id: UPDATE_TOAST_ID,
      description: t('toast.restartToApply'),
      duration: 10000, // 10 seconds, then auto-dismiss
      action: {
        label: t('toast.restart'),
        onClick: onInstall,
      },
      onDismiss: () => {
        // Persist dismissal so we don't show again after app restart
        window.electronAPI.dismissUpdate(version)
      },
    })
  }, [t])

  // Install the update
  const installUpdate = useCallback(async () => {
    try {
      // Dismiss the update toast first
      toast.dismiss(UPDATE_TOAST_ID)
      toast.info(t('toast.installingUpdate'), {
        description: t('toast.appWillRestart'),
        duration: 5000,
      })
      await window.electronAPI.installUpdate()
    } catch (error) {
      console.error('[useUpdateChecker] Install failed:', error)
      toast.error(t('toast.failedToInstallUpdate'), {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }, [t])

  const downloadUpdate = useCallback(async () => {
    try {
      toast.info(t('toast.downloadingUpdate'), { duration: 3000 })
      const info = await window.electronAPI.downloadUpdate()
      setUpdateInfo(info)
      if (info.downloadState === 'ready' && info.latestVersion) {
        shownToastVersionRef.current = null
        showUpdateToast(info.latestVersion, installUpdate)
      }
    } catch (error) {
      console.error('[useUpdateChecker] Download failed:', error)
      toast.error(t('toast.failedToDownloadUpdate'), {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }, [t, showUpdateToast, installUpdate])

  // Load initial state and check if update ready
  useEffect(() => {
    const checkAndNotify = async (info: UpdateInfo) => {
      if (!info.available || !info.latestVersion) return
      if (info.downloadState !== 'ready') return

      // Check if this version was dismissed
      const dismissedVersion = await window.electronAPI.getDismissedUpdateVersion()
      if (dismissedVersion === info.latestVersion) {
        return
      }

      // Show toast for ready update
      showUpdateToast(info.latestVersion, installUpdate)
    }

    refreshSettings()

    // Get initial update info
    window.electronAPI.getUpdateInfo().then((info) => {
      setUpdateInfo(info)
      checkAndNotify(info)
    })

    // Subscribe to update availability changes
    const cleanupAvailable = window.electronAPI.onUpdateAvailable((info) => {
      setUpdateInfo(info)
      checkAndNotify(info)
    })

    // Subscribe to download progress updates
    const cleanupProgress = window.electronAPI.onUpdateDownloadProgress((progress) => {
      setUpdateInfo((prev) => prev ? { ...prev, downloadProgress: progress } : prev)
    })

    return () => {
      cleanupAvailable()
      cleanupProgress()
    }
  }, [showUpdateToast, installUpdate, refreshSettings])

  // Check for updates manually
  const checkForUpdates = useCallback(async () => {
    try {
      const info = await window.electronAPI.checkForUpdates()
      setUpdateInfo(info)

      if (!info.available) {
        toast.success(t('toast.upToDate'), {
          description: t('toast.versionIsLatest', { version: info.currentVersion }),
          duration: 3000,
        })
      } else if (info.downloadState === 'ready' && info.latestVersion) {
        // If already ready, show toast (clear any previous dismissal since user explicitly checked)
        shownToastVersionRef.current = null // Reset so toast can show again
        showUpdateToast(info.latestVersion, installUpdate)
      } else if (info.downloadState === 'idle' && info.latestVersion) {
        toast.info(t('toast.updateAvailable'), {
          description: t('toast.downloadUpdateToInstall', { version: info.latestVersion }),
          duration: 5000,
        })
      }
    } catch (error) {
      console.error('[useUpdateChecker] Check failed:', error)
      toast.error(t('toast.failedToCheckUpdates'), {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }, [showUpdateToast, installUpdate, t])

  return {
    updateInfo,
    updateSettings,
    updateAvailable: updateInfo?.available ?? false,
    isDownloading: updateInfo?.downloadState === 'downloading',
    isReadyToInstall: updateInfo?.downloadState === 'ready',
    downloadProgress: updateInfo?.downloadProgress ?? 0,
    checkForUpdates,
    downloadUpdate,
    installUpdate,
    refreshSettings,
    setUpdateSettings,
  }
}
