/**
 * ChatPageErrorBoundary
 *
 * Per-route error boundary for ChatPage. Catches render-time crashes anywhere
 * inside the chat panel and shows a graceful fallback with a "Reload" button
 * instead of a blank screen.
 *
 * Pattern mirrors InputErrorBoundary (apps/electron/src/renderer/components/
 * app-shell/input/InputErrorBoundary.tsx) but scoped to the full chat route
 * rather than the composer sub-tree.
 *
 * Sentry is intentionally NOT imported here to keep this boundary dependency-
 * free and usable in tests without mocking @sentry/electron. The root Sentry
 * boundary in the app shell still captures the error via propagation.
 */

import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ChatPageErrorBoundaryProps {
  children: React.ReactNode
}

interface ChatPageErrorBoundaryState {
  hasError: boolean
}

export class ChatPageErrorBoundary extends React.Component<
  ChatPageErrorBoundaryProps,
  ChatPageErrorBoundaryState
> {
  state: ChatPageErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ChatPageErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ChatPageErrorBoundary] Chat panel crashed:', error, info.componentStack)
  }

  private reload = () => {
    window.location.reload()
  }

  render() {
    if (!this.state.hasError) return this.props.children
    return <ChatPageErrorFallback onReload={this.reload} />
  }
}

function ChatPageErrorFallback({ onReload }: { onReload: () => void }) {
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
          {t('chat.panelFailedTitle', 'Something went wrong in this chat')}
        </p>
        <p className="text-xs text-foreground/60">
          {t(
            'chat.panelFailedDescription',
            'The chat panel encountered an unexpected error. Reloading will restore your session.',
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
