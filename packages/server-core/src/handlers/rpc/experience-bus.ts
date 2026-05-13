/**
 * Experience Bus — in-memory pub/sub helper for the M.9 T272 server emit RPC.
 *
 * Host-side complement to the T270 kernel: accepts `ExperienceState<T>`
 * snapshots from the emit handler and fans them out to subscribers keyed
 * by `actorId`. Subscription ids come from an injectable generator so
 * tests can pin them deterministically.
 *
 * No I/O. No timers. No global state — every `createExperienceBus()` call
 * returns a fresh, isolated bus. T273 will wire one into the Electron
 * ipc-bridge so subscriptions traverse the WS transport instead of
 * staying in-process.
 */

import type { ExperienceState } from '@rox-one/shared/experience-layer'

export type ExperienceListener<T = unknown> = (state: ExperienceState<T>) => void

export interface ExperienceSubscription {
  readonly id: string
  readonly actorId: string
}

export interface ExperienceBusOptions {
  /** Subscription id generator. Defaults to a monotonic counter. */
  readonly newSubscriptionId?: () => string
  /** Optional sink for listener exceptions; absent => silent swallow. */
  readonly onListenerError?: (subscriptionId: string, err: unknown) => void
}

export interface ExperienceBus {
  subscribe<T = unknown>(actorId: string, listener: ExperienceListener<T>): ExperienceSubscription
  unsubscribe(id: string): boolean
  emit<T = unknown>(actorId: string, state: ExperienceState<T>): number
  describe(id: string): ExperienceSubscription | undefined
  subscriberCount(actorId: string): number
  size(): number
  clear(): void
}

interface SubscriptionRecord {
  readonly id: string
  readonly actorId: string
  readonly listener: ExperienceListener<unknown>
}

let monotonicSubscriptionCounter = 0
const defaultSubscriptionId = (): string => {
  monotonicSubscriptionCounter += 1
  return `s-${monotonicSubscriptionCounter.toString(36)}`
}

export function createExperienceBus(options: ExperienceBusOptions = {}): ExperienceBus {
  const newId = options.newSubscriptionId ?? defaultSubscriptionId
  const byActor = new Map<string, SubscriptionRecord[]>()
  const byId = new Map<string, SubscriptionRecord>()

  return {
    subscribe<T = unknown>(actorId: string, listener: ExperienceListener<T>): ExperienceSubscription {
      const id = newId()
      const record: SubscriptionRecord = {
        id,
        actorId,
        listener: listener as ExperienceListener<unknown>,
      }
      byId.set(id, record)
      const list = byActor.get(actorId)
      if (list) list.push(record)
      else byActor.set(actorId, [record])
      return { id, actorId }
    },

    unsubscribe(id: string): boolean {
      const record = byId.get(id)
      if (!record) return false
      byId.delete(id)
      const list = byActor.get(record.actorId)
      if (!list) return true
      const next = list.filter((r) => r.id !== id)
      if (next.length === 0) byActor.delete(record.actorId)
      else byActor.set(record.actorId, next)
      return true
    },

    emit<T = unknown>(actorId: string, state: ExperienceState<T>): number {
      const list = byActor.get(actorId)
      if (!list || list.length === 0) return 0
      let delivered = 0
      // Snapshot so listeners that mutate the bus during fan-out don't
      // disturb the in-flight iteration (standard reentrancy guard).
      const snapshot = list.slice()
      for (const record of snapshot) {
        try {
          record.listener(state as ExperienceState<unknown>)
          delivered += 1
        } catch (err) {
          options.onListenerError?.(record.id, err)
        }
      }
      return delivered
    },

    describe(id: string): ExperienceSubscription | undefined {
      const record = byId.get(id)
      return record ? { id: record.id, actorId: record.actorId } : undefined
    },

    subscriberCount(actorId: string): number {
      return byActor.get(actorId)?.length ?? 0
    },

    size(): number {
      return byId.size
    },

    clear(): void {
      byId.clear()
      byActor.clear()
    },
  }
}
