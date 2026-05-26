import * as React from 'react'
import { AlertCircle, Palette, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { RoxDesignBounds, RoxDesignStatus } from '../../../shared/types'

const MISSING_BRIDGE_STATUS: RoxDesignStatus = {
  status: 'failed',
  error: 'Rox Design bridge is not available in this renderer.',
}

export function RoxDesignPage() {
  const [status, setStatus] = React.useState<RoxDesignStatus>({ status: 'idle' })
  const [isRetrying, setIsRetrying] = React.useState(false)
  const hostRef = React.useRef<HTMLDivElement | null>(null)

  const startRuntime = React.useCallback(async () => {
    const api = window.electronAPI?.roxDesign
    if (!api) {
      setStatus(MISSING_BRIDGE_STATUS)
      return
    }

    setStatus((current) => ({ ...current, status: 'starting', error: undefined }))
    try {
      const nextStatus = await api.start()
      setStatus(nextStatus)
    } catch (error) {
      setStatus({
        status: 'failed',
        error: error instanceof Error ? error.message : 'Rox Design runtime failed to start.',
      })
    }
  }, [])

  React.useEffect(() => {
    void startRuntime()
  }, [startRuntime])


  const readHostBounds = React.useCallback((): RoxDesignBounds => {
    const rect = hostRef.current?.getBoundingClientRect()
    return {
      x: rect ? rect.left : 0,
      y: rect ? rect.top : 0,
      width: Math.max(1, rect?.width ?? 1),
      height: Math.max(1, rect?.height ?? 1),
    }
  }, [])

  React.useEffect(() => {
    const api = window.electronAPI?.roxDesign
    if (!api || status.status !== 'running' || !status.webUrl) return

    let disposed = false
    let frame: number | null = null
    let hasShown = false

    const syncNativeView = async () => {
      if (disposed) return
      const bounds = readHostBounds()
      try {
        if (!hasShown) {
          await api.show({ url: status.webUrl!, bounds })
          hasShown = true
        } else {
          await api.setBounds(bounds)
        }
      } catch (error) {
        if (!disposed) {
          setStatus({
            status: 'failed',
            error: error instanceof Error ? error.message : 'Rox Design native view failed to attach.',
          })
        }
      }
    }

    const scheduleSync = () => {
      if (disposed || frame != null) return
      frame = window.requestAnimationFrame(() => {
        frame = null
        void syncNativeView()
      })
    }

    void syncNativeView()
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(scheduleSync) : null
    if (hostRef.current && observer) observer.observe(hostRef.current)
    window.addEventListener('resize', scheduleSync)
    window.addEventListener('scroll', scheduleSync, true)

    return () => {
      disposed = true
      if (frame != null) window.cancelAnimationFrame(frame)
      observer?.disconnect()
      window.removeEventListener('resize', scheduleSync)
      window.removeEventListener('scroll', scheduleSync, true)
      void api.hide().catch(() => undefined)
    }
  }, [readHostBounds, status.status, status.webUrl])

  const handleRetry = React.useCallback(async () => {
    setIsRetrying(true)
    try {
      await startRuntime()
    } finally {
      setIsRetrying(false)
    }
  }, [startRuntime])

  if (status.status === 'running' && status.webUrl) {
    return (
      <section className="relative h-full min-h-0 overflow-hidden bg-background" aria-label="Rox Design">
        <div
          ref={hostRef}
          data-testid="rox-design-native-host"
          data-rox-design-surface="native"
          className="absolute inset-0 min-h-0 bg-transparent"
          aria-label="Область Rox Design"
        />
      </section>
    )
  }

  if (status.status === 'failed') {
    return (
      <section className="flex h-full items-center justify-center bg-background px-6" aria-labelledby="rox-design-title">
        <div className="w-full max-w-lg rounded-2xl border border-border/70 bg-card/60 p-6 shadow-minimal">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
              <AlertCircle className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h1 id="rox-design-title" className="text-lg font-semibold text-foreground">Rox Design</h1>
              <p className="text-sm text-muted-foreground">Встроенный модуль дизайна пока не запущен.</p>
            </div>
          </div>

          <p className="mb-5 text-sm leading-6 text-muted-foreground">
            {status.error ?? 'Rox Design runtime failed to start.'}
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" onClick={handleRetry} disabled={isRetrying}>
              <RefreshCw className={isRetrying ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} aria-hidden="true" />
              Повторить
            </Button>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="flex h-full items-center justify-center bg-background px-6" aria-labelledby="rox-design-title">
      <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card/60 px-5 py-4 shadow-minimal">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-foreground/5 text-foreground">
          <Palette className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <h1 id="rox-design-title" className="text-base font-semibold text-foreground">Rox Design</h1>
          <p className="text-sm text-muted-foreground">Запускаем Rox Design…</p>
        </div>
      </div>
    </section>
  )
}

export default RoxDesignPage
