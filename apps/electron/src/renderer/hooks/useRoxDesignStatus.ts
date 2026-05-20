/**
 * useRoxDesignStatus — subscribes to `rox-design:status-changed` IPC
 * broadcasts from the main process and exposes the current runtime status.
 *
 * On mount it requests the current status via `roxDesign.getStatus()` so the
 * button always reflects the true state even after a hot reload.
 */

import { useState, useEffect } from 'react'
import type { RoxDesignStatus } from '../../shared/types'

interface UseRoxDesignStatusResult {
  status: RoxDesignStatus['status']
  error: string | undefined
}

export function useRoxDesignStatus(): UseRoxDesignStatusResult {
  const [status, setStatus] = useState<RoxDesignStatus>({ status: 'idle' })

  useEffect(() => {
    // Fetch current status on mount so we reflect reality after hot reload
    window.electronAPI.roxDesign?.getStatus().then((s) => {
      setStatus(s)
    }).catch(() => {
      // If the API is unavailable, stay at idle
    })

    // Subscribe to push updates from the main process
    const unsubscribe = window.electronAPI.onRoxDesignStatusChanged((s) => {
      setStatus(s)
    })

    return unsubscribe
  }, [])

  return {
    status: status.status,
    error: status.error,
  }
}
