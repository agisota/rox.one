/**
 * QuitOrchestrator — parallel, fault-isolated, timeout-bounded shutdown.
 *
 * Usage:
 *   const orchestrator = new QuitOrchestrator()
 *   orchestrator.register('sessionManager', () => sessionManager.flushAllSessions())
 *   orchestrator.register('browserPaneManager', () => browserPaneManager.destroyAll())
 *   const result = await orchestrator.shutdown(15_000)
 */

const DEFAULT_HANDLER_TIMEOUT_MS = 5_000

export interface ShutdownResult {
  /** Names of handlers that resolved successfully. */
  completed: string[]
  /** Handlers that threw or rejected. */
  failed: Array<{ name: string; error: Error; critical: boolean }>
  /** Handlers whose per-handler timeout fired before they resolved. */
  timedOut: string[]
  /** Subset of timedOut that had critical: true. */
  criticalTimedOut: string[]
}

export interface RegisterOptions {
  /** Per-handler timeout in ms. Defaults to 5 000 ms. */
  timeoutMs?: number
  /**
   * When true, a failure or timeout from this handler is flagged in the result
   * so the caller can decide to surface it prominently (e.g. skip app.exit).
   */
  critical?: boolean
}

interface HandlerEntry {
  name: string
  dispose: () => Promise<void> | void
  timeoutMs: number
  critical: boolean
}

export class QuitOrchestrator {
  private readonly handlers: HandlerEntry[] = []

  /**
   * Register a cleanup handler.
   *
   * @param name     Unique identifier used in the result report.
   * @param dispose  Async (or sync) cleanup function.
   * @param opts     Optional per-handler timeout and critical flag.
   */
  register(
    name: string,
    dispose: () => Promise<void> | void,
    opts: RegisterOptions = {},
  ): void {
    this.handlers.push({
      name,
      dispose,
      timeoutMs: opts.timeoutMs ?? DEFAULT_HANDLER_TIMEOUT_MS,
      critical: opts.critical ?? false,
    })
  }

  /**
   * Run all registered handlers in parallel, honouring per-handler timeouts.
   *
   * @param _globalTimeoutMs  Reserved for future global cap (not enforced here;
   *                          callers can wrap with their own Promise.race if needed).
   * @returns Structured summary of completed / failed / timedOut handlers.
   */
  async shutdown(_globalTimeoutMs?: number): Promise<ShutdownResult> {
    const result: ShutdownResult = {
      completed: [],
      failed: [],
      timedOut: [],
      criticalTimedOut: [],
    }

    await Promise.all(
      this.handlers.map(async (entry) => {
        try {
          await Promise.race([
            Promise.resolve(entry.dispose()),
            new Promise<never>((_resolve, reject) =>
              setTimeout(
                () => reject(new _TimeoutSentinel(entry.name)),
                entry.timeoutMs,
              ),
            ),
          ])
          result.completed.push(entry.name)
        } catch (err) {
          if (err instanceof _TimeoutSentinel) {
            result.timedOut.push(entry.name)
            if (entry.critical) {
              result.criticalTimedOut.push(entry.name)
            }
          } else {
            result.failed.push({
              name: entry.name,
              error: err instanceof Error ? err : new Error(String(err)),
              critical: entry.critical,
            })
          }
        }
      }),
    )

    return result
  }
}

/** Internal sentinel — never escapes the module boundary. */
class _TimeoutSentinel extends Error {
  constructor(handlerName: string) {
    super(`QuitOrchestrator: handler "${handlerName}" timed out`)
    this.name = '_TimeoutSentinel'
  }
}
