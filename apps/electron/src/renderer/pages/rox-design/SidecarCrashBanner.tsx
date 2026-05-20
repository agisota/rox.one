import * as React from 'react'
import { useTranslation } from 'react-i18next'
import * as Sentry from '@sentry/electron/renderer'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { RoxDesignSidecarExitedPayload } from '../../../shared/types'

/**
 * SidecarCrashBanner — PZD-81 follow-up
 *
 * Subscribes to `electronAPI.onRoxDesignSidecarExited` and surfaces a one-click
 * recovery banner when the Rox Design daemon/web sidecar exits unexpectedly
 * mid-session. The visual style mirrors `TransportConnectionBanner` (amber
 * tone) so the user immediately recognises this as a transient runtime issue.
 *
 * Lifecycle:
 *   - mount → subscribe; on unmount → unsubscribe
 *   - render only when crashState !== null
 *   - retry calls `electronAPI.roxDesign?.start()`; clears crashState on
 *     success, leaves banner visible (and re-enables the button) on failure
 *   - dismiss clears crashState without re-spawning the runtime
 *
 * Telemetry: emits Sentry breadcrumbs for crash-recovery attempt /
 * success / failure so we can track recovery-flow effectiveness over time.
 */
export function SidecarCrashBanner(): React.ReactElement | null {
  const { t } = useTranslation()
  const [crashState, setCrashState] = React.useState<RoxDesignSidecarExitedPayload | null>(null)
  const [isRetrying, setIsRetrying] = React.useState(false)

  React.useEffect(() => {
    const subscribe = window.electronAPI?.onRoxDesignSidecarExited
    if (typeof subscribe !== 'function') return
    const unsubscribe = subscribe((payload) => {
      setCrashState(payload)
    })
    return () => {
      try {
        unsubscribe?.()
      } catch {
        // best-effort unsubscribe; ignore disposal errors
      }
    }
  }, [])

  const handleRetry = React.useCallback(async () => {
    const api = window.electronAPI?.roxDesign
    if (!api) return
    setIsRetrying(true)
    Sentry.addBreadcrumb({
      category: 'rox-design.crash-recovery',
      message: '[rox-design.crash-recovery.attempt]',
      level: 'info',
      data: crashState ?? undefined,
    })
    try {
      await api.start()
      Sentry.addBreadcrumb({
        category: 'rox-design.crash-recovery',
        message: '[rox-design.crash-recovery.success]',
        level: 'info',
      })
      setCrashState(null)
    } catch (error) {
      Sentry.addBreadcrumb({
        category: 'rox-design.crash-recovery',
        message: '[rox-design.crash-recovery.failure]',
        level: 'warning',
        data: { error: error instanceof Error ? error.message : String(error) },
      })
    } finally {
      setIsRetrying(false)
    }
  }, [crashState])

  const handleDismiss = React.useCallback(() => {
    setCrashState(null)
  }, [])

  if (!crashState) return null

  return (
    <div
      role="alert"
      data-testid="sidecar-crash-banner"
      className="shrink-0 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-amber-700 dark:text-amber-300"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{t('roxDesign.crashRecovery.title')}</p>
          <p className="text-xs opacity-90 truncate">{t('roxDesign.crashRecovery.body')}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleRetry}
            disabled={isRetrying}
            className="h-7"
          >
            {isRetrying ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : null}
            {t('roxDesign.crashRecovery.retry')}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleDismiss}
            disabled={isRetrying}
            className="h-7"
          >
            {t('roxDesign.crashRecovery.dismiss')}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default SidecarCrashBanner
