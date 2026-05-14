/**
 * Experience Layer IPC bridge — M.9 T273.
 *
 * Renderer-side adapter that turns the server-emitted `experience.event`
 * push channel (T272) into an `Observable<ExperienceState<T>>` shape that
 * the T271 `useExperience(initial, source$, ...)` hook can subscribe to
 * directly.
 *
 *   const bridge$ = createExperienceIpcBridge(rpcClient, { actorId })
 *   // ...inside a React component:
 *   const r = useExperience(idle(id), bridge$, runMutation)
 *
 * The bridge owns exactly one upstream `rpcClient.subscribe('experience.event', ...)`
 * call regardless of how many renderer hooks subscribe to the returned
 * observable — multiplexing happens in-process. Inbound payloads matching
 * the bound `actorId` are forwarded as observable emissions; non-matching
 * payloads are ignored so a single client subscription can carry many
 * experiences. Dispose releases the upstream subscription.
 *
 * The bridge is intentionally transport-agnostic: it speaks the smallest
 * possible `ExperienceIpcRpcClient` interface so unit tests can mock it
 * without depending on Electron or the WS transport. Production callers
 * pass a real adapter constructed in `apps/electron/src/renderer/main.tsx`
 * (wiring lives in T274 — first consumer).
 *
 * The `Observable<T>` shape returned here matches the T270 kernel's
 * minimal observable (the same one `useExperience` accepts) — a `subscribe`
 * method returning an `Unsubscribe` thunk. No rxjs dependency.
 */

import type {
  ExperienceState,
  Observable,
  Observer,
  Unsubscribe,
} from '@rox-one/shared/experience-layer'

/**
 * Inbound push payload as emitted by the T272 server handler.
 *
 * The T272 push call is
 *   `server.push('experience.event', {to:'client', clientId}, { actorId, state })`
 * — so each delivered envelope carries an `actorId` and the new
 * `ExperienceState<T>` snapshot.
 */
export interface ExperienceEventEnvelope<T = unknown> {
  readonly actorId: string
  readonly state: ExperienceState<T>
}

/**
 * Minimal RPC-client interface the bridge depends on.
 *
 * Production binds this to a `window.electronAPI.rpc` adapter; tests pass
 * an in-memory stub. Kept independent of any shared client interface so
 * the bridge file stays self-contained.
 */
export interface ExperienceIpcRpcClient {
  /**
   * Subscribes to a server push channel. Returns an `Unsubscribe` thunk
   * that releases the subscription idempotently. Implementations MAY
   * batch deliveries but MUST preserve relative ordering per channel.
   */
  subscribe(
    channel: string,
    handler: (payload: ExperienceEventEnvelope<unknown>) => void,
  ): Unsubscribe
}

export interface CreateBridgeOptions {
  /**
   * Channel string for the server's push events. Defaults to the T272
   * channel name. Exposed for tests and future channel-name migrations.
   */
  readonly channel?: string
  /**
   * Optional sink for malformed payloads. Absent → silent swallow. The
   * bridge never throws on bad envelopes; bad envelopes are dropped so
   * one misbehaving host doesn't break every renderer subscription.
   */
  readonly onPayloadError?: (payload: unknown, reason: string) => void
}

/** Default push channel name — must match T272 `EXPERIENCE_CHANNELS.EVENT`. */
export const EXPERIENCE_EVENT_CHANNEL = 'experience.event'

/**
 * Structural check on inbound payloads. Matches the T272 validator shape
 * (`isExperienceState`) so non-matching deliveries are dropped at the
 * boundary instead of corrupting reducer state downstream.
 */
function isExperienceEnvelope(value: unknown): value is ExperienceEventEnvelope<unknown> {
  if (!value || typeof value !== 'object') return false
  const c = value as Record<string, unknown>
  if (typeof c.actorId !== 'string' || c.actorId.length === 0) return false
  const state = c.state as Record<string, unknown> | undefined
  if (!state || typeof state !== 'object') return false
  const kind = state.kind
  if (typeof kind !== 'string') return false
  if (
    kind !== 'idle' &&
    kind !== 'loading' &&
    kind !== 'ready' &&
    kind !== 'error' &&
    kind !== 'mutating'
  ) {
    return false
  }
  return typeof state.id === 'string' && (state.id as string).length > 0
}

/**
 * Creates an `Observable<ExperienceState<T>>` that emits whenever the
 * server pushes an `experience.event` matching `actorId`.
 *
 * The bridge holds exactly one upstream RPC subscription. Multiple hook
 * subscribers share that single subscription; the upstream is released
 * when the last subscriber unsubscribes (and re-acquired if a new
 * subscriber arrives later).
 */
export function createExperienceIpcBridge<T = unknown>(
  rpcClient: ExperienceIpcRpcClient,
  binding: { readonly actorId: string },
  options: CreateBridgeOptions = {},
): Observable<ExperienceState<T>> {
  const channel = options.channel ?? EXPERIENCE_EVENT_CHANNEL
  const onPayloadError = options.onPayloadError
  const observers = new Set<Observer<ExperienceState<T>>>()
  let upstreamUnsub: Unsubscribe | null = null

  const ensureUpstream = (): void => {
    if (upstreamUnsub) return
    upstreamUnsub = rpcClient.subscribe(channel, (payload) => {
      if (!isExperienceEnvelope(payload)) {
        onPayloadError?.(payload, 'invalid-envelope')
        return
      }
      if (payload.actorId !== binding.actorId) return
      // Snapshot so an observer that mutates the set during dispatch
      // doesn't disturb the in-flight fan-out (same discipline as the
      // T270 bus reentrancy guard).
      const snapshot = Array.from(observers)
      for (const obs of snapshot) {
        try {
          obs.next(payload.state as ExperienceState<T>)
        } catch {
          /* observer errors are isolated — never reach the upstream. */
        }
      }
    })
  }

  const releaseUpstream = (): void => {
    if (!upstreamUnsub) return
    const fn = upstreamUnsub
    upstreamUnsub = null
    try {
      fn()
    } catch {
      /* upstream release must not throw. */
    }
  }

  return {
    subscribe(observer): Unsubscribe {
      observers.add(observer)
      ensureUpstream()
      let released = false
      return () => {
        if (released) return
        released = true
        observers.delete(observer)
        if (observers.size === 0) releaseUpstream()
      }
    },
  }
}
