/**
 * Rox Design performance telemetry (PZD-83 / spec §1.6.A).
 *
 * Pure-function module that emits a structured stream of perf records:
 *   - first-show   = cold cold-start lifecycle (first time in this app launch)
 *   - warm-open    = subsequent lifecycle in the same app launch
 *   - inp-sample   = renderer-reported INP samples for the embedded view
 *
 * The module never depends on Electron directly — it accepts a {@link RoxDesignTelemetrySink}
 * the caller wires to Sentry breadcrumbs, structured mainLog, or any future
 * pipeline. Phase spans are pushed using {@link performance.mark} / {@link performance.measure}
 * when a Performance API is available so DevTools and Sentry breadcrumbs both pick them up.
 *
 * Sink failures are intentionally swallowed (logged via the optional onSinkError hook):
 * telemetry must never break the lifecycle code it observes.
 */
export type RoxDesignPhase =
  | 'spawn-sidecar'
  | 'register-desktop-auth'
  | 'attach-view'
  | 'load-url'
  | 'dom-ready'
  | 'did-finish-load'

export type RoxDesignTelemetryEvent = 'first-show' | 'warm-open' | 'inp-sample'

export interface RoxDesignTelemetryRecord {
  integration: 'rox-design'
  event: RoxDesignTelemetryEvent
  phase?: RoxDesignPhase
  durationMs: number
  platform: 'darwin' | 'linux' | 'win32'
  arch: 'arm64' | 'x64'
  cold: boolean
}

export interface RoxDesignTelemetrySink {
  emit(record: RoxDesignTelemetryRecord): void
}

interface PerformanceLike {
  mark(name: string): unknown
  measure(name: string, start?: string, end?: string): unknown
  now?: () => number
}

export interface RoxDesignTelemetryOptions {
  sink: RoxDesignTelemetrySink
  platform?: 'darwin' | 'linux' | 'win32'
  arch?: 'arm64' | 'x64'
  now?: () => number
  performance?: PerformanceLike | null
  onSinkError?: (error: unknown, record: RoxDesignTelemetryRecord) => void
}

export interface RoxDesignPhaseSpan {
  end(): void
}

export interface RoxDesignShowSpan {
  startPhase(phase: RoxDesignPhase): RoxDesignPhaseSpan
  end(): void
}

export interface RoxDesignTelemetry {
  startShow(): RoxDesignShowSpan
  reportInpSample(durationMs: number): void
  /** Test/diagnostic helper — forces next `startShow()` to be treated as cold. */
  resetColdFlag(): void
}

const INP_MIN_MS = 0
// Anything above 5s is almost certainly a stale or buggy measurement, not a
// real INP — the web-vitals spec also drops samples beyond this range.
const INP_MAX_MS = 5_000

function normalizePlatform(value: NodeJS.Platform): 'darwin' | 'linux' | 'win32' {
  if (value === 'darwin' || value === 'linux' || value === 'win32') return value
  // Other platforms (aix, freebsd, openbsd, sunos, android, haiku, netbsd, cygwin)
  // are not supported by our packaged builds — map them to 'linux' so dashboards
  // still receive samples for diagnostic purposes.
  return 'linux'
}

function normalizeArch(value: NodeJS.Architecture): 'arm64' | 'x64' {
  if (value === 'arm64' || value === 'x64') return value
  return 'x64'
}

function resolvePerformance(option: PerformanceLike | null | undefined): PerformanceLike | null {
  if (option === null) return null
  if (option) return option
  const fromGlobal = (globalThis as { performance?: PerformanceLike }).performance
  return fromGlobal ?? null
}

export function createRoxDesignTelemetry(options: RoxDesignTelemetryOptions): RoxDesignTelemetry {
  const platform = options.platform ?? normalizePlatform(process.platform)
  const arch = options.arch ?? normalizeArch(process.arch)
  const now = options.now ?? (() => {
    const perfNow = (options.performance ?? (globalThis as { performance?: PerformanceLike }).performance)?.now
    return typeof perfNow === 'function' ? perfNow() : Date.now()
  })
  const perf = resolvePerformance(options.performance)

  let hasOpenedOnce = false
  let showSequence = 0

  const safeEmit = (record: RoxDesignTelemetryRecord): void => {
    try {
      options.sink.emit(record)
    } catch (error) {
      try {
        options.onSinkError?.(error, record)
      } catch {
        // never let observer-of-observer failure crash the host
      }
    }
  }

  const safeMark = (name: string): void => {
    if (!perf) return
    try {
      perf.mark(name)
    } catch {
      // best-effort: marks are diagnostic only
    }
  }

  const safeMeasure = (name: string, start: string, end: string): void => {
    if (!perf) return
    try {
      perf.measure(name, start, end)
    } catch {
      // best-effort
    }
  }

  const startShow = (): RoxDesignShowSpan => {
    const cold = !hasOpenedOnce
    showSequence += 1
    const seq = showSequence
    const startedAt = now()
    let ended = false

    safeMark(`rox-design:show:${seq}:start`)

    const startPhase = (phase: RoxDesignPhase): RoxDesignPhaseSpan => {
      const phaseStart = now()
      let phaseEnded = false
      safeMark(`rox-design:show:${seq}:phase:${phase}:start`)
      return {
        end() {
          if (phaseEnded) return
          phaseEnded = true
          const phaseEnd = now()
          safeMark(`rox-design:show:${seq}:phase:${phase}:end`)
          safeMeasure(
            `rox-design:show:${seq}:phase:${phase}`,
            `rox-design:show:${seq}:phase:${phase}:start`,
            `rox-design:show:${seq}:phase:${phase}:end`,
          )
          const durationMs = Math.max(0, Math.round(phaseEnd - phaseStart))
          safeEmit({
            integration: 'rox-design',
            event: cold ? 'first-show' : 'warm-open',
            phase,
            durationMs,
            platform,
            arch,
            cold,
          })
        },
      }
    }

    const end = (): void => {
      if (ended) return
      ended = true
      const endedAt = now()
      safeMark(`rox-design:show:${seq}:end`)
      safeMeasure(
        `rox-design:show:${seq}`,
        `rox-design:show:${seq}:start`,
        `rox-design:show:${seq}:end`,
      )
      const totalMs = Math.max(0, Math.round(endedAt - startedAt))
      safeEmit({
        integration: 'rox-design',
        event: cold ? 'first-show' : 'warm-open',
        durationMs: totalMs,
        platform,
        arch,
        cold,
      })
      hasOpenedOnce = true
    }

    return { startPhase, end }
  }

  const reportInpSample = (durationMs: number): void => {
    if (!Number.isFinite(durationMs)) return
    if (durationMs < INP_MIN_MS || durationMs > INP_MAX_MS) return
    safeEmit({
      integration: 'rox-design',
      event: 'inp-sample',
      durationMs: Math.round(durationMs),
      platform,
      arch,
      cold: false,
    })
  }

  const resetColdFlag = (): void => {
    hasOpenedOnce = false
  }

  return { startShow, reportInpSample, resetColdFlag }
}
