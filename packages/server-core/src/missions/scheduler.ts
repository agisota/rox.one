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

import type { AuditEventInput, AuditProducer } from '@rox-one/shared/observability'

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
  /**
   * Optional audit producer (T246). When provided, the scheduler emits
   * `MissionStarted` / `MissionCompleted` / `MissionFailed` audit events
   * on the matching successful transitions. Callers that have not adopted
   * the observability surface may omit this option — emission becomes a
   * no-op and the scheduler behaves identically to the pre-T246 baseline.
   */
  readonly auditProducer?: AuditProducer
  /**
   * Optional workspace id stamped into emitted audit events. The mission
   * algebra does not carry a workspace association (missions are scoped
   * by id alone), so callers that want their audit records bucketed by
   * workspace can pass it here. When absent, events are emitted with
   * `scope: { kind: 'global' }`.
   */
  readonly workspaceId?: string
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
  private readonly auditProducer?: AuditProducer
  private readonly workspaceId?: string
  /**
   * `Running` start timestamps captured per mission id, used to compute
   * `durationMs` on `MissionCompleted`. We index by mission id rather than
   * threading state through dispatch results so the public API stays
   * unchanged. Entries are pruned on terminal transitions (Complete/Fail)
   * so the map never grows past the active-mission count.
   */
  private readonly startedAt = new Map<MissionId, string>()

  constructor(options: MissionSchedulerOptions) {
    this.store = options.store
    this.clock = options.clock ?? defaultClock()
    const random = options.random ?? defaultRandom()
    this.uuid = options.uuid ?? defaultUuidFromClock(this.clock, random)
    this.auditProducer = options.auditProducer
    this.workspaceId = options.workspaceId
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
    this.emitAuditForTransition(id, event, result.value)
    return { ok: true, value: next }
  }

  /**
   * Audit fan-out for the three mission lifecycle events the M.14 taxonomy
   * recognises. Called only after the store write succeeds so a persistence
   * failure leaves no spurious audit record. The producer is optional —
   * when absent this is a hot no-op (single property read).
   *
   * `MissionStarted` captures the start timestamp so we can compute
   * `durationMs` when the same mission later transitions to Completed.
   * `MissionFailed` does not emit a duration (the audit taxonomy only
   * carries `errorMessage`).
   */
  private emitAuditForTransition(
    id: MissionId,
    event: SchedulerInputEvent,
    nextState: MissionState,
  ): void {
    if (event.kind === 'Start' && nextState.kind === 'Running') {
      this.startedAt.set(id, nextState.startedAt)
      if (this.auditProducer) {
        const input: AuditEventInput = {
          kind: 'MissionStarted',
          actor: { type: 'system' },
          subject: { type: 'mission', id },
          scope: this.missionScope(id),
          missionId: id,
        }
        this.auditProducer.emit(input)
      }
      return
    }

    if (event.kind === 'Complete' && nextState.kind === 'Completed') {
      const startedAt = this.startedAt.get(id)
      const durationMs = startedAt ? Date.parse(nextState.at) - Date.parse(startedAt) : 0
      this.startedAt.delete(id)
      if (this.auditProducer) {
        const input: AuditEventInput = {
          kind: 'MissionCompleted',
          actor: { type: 'system' },
          subject: { type: 'mission', id },
          scope: this.missionScope(id),
          missionId: id,
          durationMs: Math.max(0, durationMs),
        }
        this.auditProducer.emit(input)
      }
      return
    }

    if (event.kind === 'Fail' && nextState.kind === 'Failed') {
      this.startedAt.delete(id)
      if (this.auditProducer) {
        const input: AuditEventInput = {
          kind: 'MissionFailed',
          actor: { type: 'system' },
          subject: { type: 'mission', id },
          scope: this.missionScope(id),
          missionId: id,
          errorMessage: nextState.reason,
        }
        this.auditProducer.emit(input)
      }
      return
    }
  }

  /**
   * Build the canonical audit scope envelope for a mission. When the
   * scheduler was constructed with a `workspaceId` we tag events as
   * `{ kind: 'mission', workspaceId, missionId }` so the audit log can be
   * filtered per-workspace. Without it, we fall back to global scope.
   */
  private missionScope(id: MissionId): AuditEventInput['scope'] {
    if (this.workspaceId) {
      return { kind: 'mission', workspaceId: this.workspaceId, missionId: id }
    }
    return { kind: 'global' }
  }

  async get(id: MissionId): Promise<MissionRecord | undefined> {
    return this.store.get(id)
  }

  async list(filter: MissionListFilter): Promise<readonly MissionRecord[]> {
    return this.store.list(filter)
  }
}
