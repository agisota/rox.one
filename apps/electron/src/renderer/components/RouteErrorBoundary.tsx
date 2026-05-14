/**
 * RouteErrorBoundary
 *
 * Generic per-route error boundary. Catches render-time crashes anywhere inside
 * a page route and shows a graceful fallback with a "Reload" button instead of
 * a blank screen.
 *
 * Pattern mirrors ChatPageErrorBoundary (apps/electron/src/renderer/pages/
 * ChatPageErrorBoundary.tsx) but is generic so a single component covers all
 * 14 remaining routes without 14 separate boundary files.
 *
 * Sentry is intentionally NOT imported here to keep this boundary dependency-
 * free and usable in tests without mocking @sentry/electron. The root Sentry
 * boundary in the app shell still captures the error via propagation.
 *
 * Usage:
 *   <RouteErrorBoundary name="account-settings">
 *     <AccountSettingsPage />
 *   </RouteErrorBoundary>
 *
 * The `name` prop is used in the fallback title and log emission so crashes can
 * be identified per route in the console / log files.
 */

import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface RouteErrorBoundaryProps {
  /** Stable route identifier used in fallback title and console log (e.g. "account-settings"). */
  name: string
  children: React.ReactNode
}

interface RouteErrorBoundaryState {
  hasError: boolean
}

export class RouteErrorBoundary extends React.Component<
  RouteErrorBoundaryProps,
  RouteErrorBoundaryState
> {
  state: RouteErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): RouteErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(
      `[RouteErrorBoundary:${this.props.name}] Route crashed:`,
      error,
      info.componentStack,
    )
  }

  private reload = () => {
    window.location.reload()
  }

  render() {
    if (!this.state.hasError) return this.props.children
    return <RouteErrorFallback name={this.props.name} onReload={this.reload} />
  }
}

function RouteErrorFallback({ name, onReload }: { name: string; onReload: () => void }) {
  const { t } = useTranslation()

  return (
    <div
      role="alert"
      className="h-full flex flex-col items-center justify-center gap-4 p-8 text-center"
    >
      <div className="rounded-full bg-destructive/10 p-4 text-destructive">
        <AlertCircle className="h-8 w-8" aria-hidden="true" />
      </div>
      <div className="max-w-sm space-y-2">
        <p className="text-sm font-medium text-foreground">
          {t('route.pageFailedTitle', 'Something went wrong on this page')}
        </p>
        <p className="text-xs text-foreground/60">
          {t(
            'route.pageFailedDescription',
            'The {{name}} page encountered an unexpected error. Reloading will restore the application.',
            { name },
          )}
        </p>
      </div>
      <Button type="button" size="sm" variant="secondary" onClick={onReload}>
        <RefreshCw className="h-4 w-4" aria-hidden="true" />
        {t('common.reload', 'Reload')}
      </Button>
    </div>
  )
}
