/**
 * MissionScheduler — pure orchestration over a `MissionStore` and the
 * `transition` algebra. The scheduler is the only place where the clock
 * and id generator are read; the store, transitions, and state modules
 * all stay deterministic.
 *
 * No real I/O: persistence is delegated entirely to the injected store.
 * Tests should pass a deterministic clock + uuid generator + an
 * `InMemoryMissionStore`.
 */

import { generateMissionId, type MissionId } from './mission-id.ts'
import type {
  MissionListFilter,
  MissionRecord,
  MissionStore,
} from './mission-store.ts'
import type { MissionState } from './state.ts'
import { transition, type MissionEvent, type TransitionError } from './transitions.ts'

export interface MissionClock {
  now(): string
}

export type UuidGenerator = () => MissionId

export type SchedulerInputEvent =
  | { readonly kind: 'Start' }
  | { readonly kind: 'Pause'; readonly reason: string }
  | { readonly kind: 'Resume' }
  | { readonly kind: 'AwaitInput'; readonly prompt: string }
  | { readonly kind: 'ProvideInput'; readonly input: string }
  | { readonly kind: 'Complete'; readonly output: string }
  | { readonly kind: 'Fail'; readonly reason: string }
  | { readonly kind: 'Cancel'; readonly reason: string }

export type DispatchError =
  | TransitionError
  | { readonly kind: 'mission_not_found'; readonly id: MissionId; readonly message: string }

export type DispatchResult =
  | { readonly ok: true; readonly value: MissionRecord }
  | { readonly ok: false; readonly error: DispatchError }

export interface MissionSchedulerOptions {
  readonly store: MissionStore
  readonly clock?: MissionClock
  readonly uuid?: UuidGenerator
  readonly random?: () => Uint8Array
}

function defaultClock(): MissionClock {
  return { now: () => new Date().toISOString() }
}

function defaultRandom(): () => Uint8Array {
  return () => {
    const bytes = new Uint8Array(10)
    if (typeof globalThis.crypto?.getRandomValues === 'function') {
      globalThis.crypto.getRandomValues(bytes)
    } else {
      for (let i = 0; i < bytes.length; i += 1) {
        bytes[i] = Math.floor(Math.random() * 256)
      }
    }
    return bytes
  }
}

function defaultUuidFromClock(clock: MissionClock, random: () => Uint8Array): UuidGenerator {
  return () => generateMissionId(Date.parse(clock.now()), random())
}

function stamp(event: SchedulerInputEvent, at: string): MissionEvent {
  switch (event.kind) {
    case 'Start':
      return { kind: 'Start', at }
    case 'Pause':
      return { kind: 'Pause', at, reason: event.reason }
    case 'Resume':
      return { kind: 'Resume', at }
    case 'AwaitInput':
      return { kind: 'AwaitInput', at, prompt: event.prompt }
    case 'ProvideInput':
      return { kind: 'ProvideInput', at, input: event.input }
    case 'Complete':
      return { kind: 'Complete', at, output: event.output }
    case 'Fail':
      return { kind: 'Fail', at, reason: event.reason }
    case 'Cancel':
      return { kind: 'Cancel', at, reason: event.reason }
  }
}

export class MissionScheduler {
  private readonly store: MissionStore
  private readonly clock: MissionClock
  private readonly uuid: UuidGenerator

  constructor(options: MissionSchedulerOptions) {
    this.store = options.store
    this.clock = options.clock ?? defaultClock()
    const random = options.random ?? defaultRandom()
    this.uuid = options.uuid ?? defaultUuidFromClock(this.clock, random)
  }

  async create(): Promise<MissionRecord> {
    const id = this.uuid()
    const at = this.clock.now()
    const state: MissionState = { kind: 'Pending', createdAt: at }
    const record: MissionRecord = { id, state }
    await this.store.put(record)
    return record
  }

  async dispatchEvent(id: MissionId, event: SchedulerInputEvent): Promise<DispatchResult> {
    const existing = await this.store.get(id)
    if (!existing) {
      return {
        ok: false,
        error: {
          kind: 'mission_not_found',
          id,
          message: `No mission with id ${id}`,
        },
      }
    }
    const stamped = stamp(event, this.clock.now())
    const result = transition(existing.state, stamped)
    if (!result.ok) {
      return { ok: false, error: result.error }
    }
    const next: MissionRecord = { id: existing.id, state: result.value }
    await this.store.put(next)
    return { ok: true, value: next }
  }

  async get(id: MissionId): Promise<MissionRecord | undefined> {
    return this.store.get(id)
  }

  async list(filter: MissionListFilter): Promise<readonly MissionRecord[]> {
    return this.store.list(filter)
  }
}
