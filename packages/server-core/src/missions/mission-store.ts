/**
 * Mission persistence boundary.
 *
 * `MissionStore` is the only persistence abstraction the scheduler depends
 * on. The interface returns plain promises so async backends (sqlite, pg)
 * can plug in without changing call sites. The `InMemoryMissionStore`
 * reference implementation is backed by a plain `Map` for test/dev runs.
 *
 * Records are immutable from the store's perspective — callers always
 * compute a new `MissionRecord` value and call `put`. The store keeps a
 * defensive copy so external mutations cannot leak into snapshots.
 */

import type { MissionId } from './mission-id.ts'
import type { MissionState, MissionStateKind } from './state.ts'

export interface MissionRecord {
  readonly id: MissionId
  readonly state: MissionState
}

export interface MissionListFilter {
  readonly kinds?: readonly MissionStateKind[]
}

export interface MissionStore {
  get(id: MissionId): Promise<MissionRecord | undefined>
  put(record: MissionRecord): Promise<void>
  delete(id: MissionId): Promise<boolean>
  list(filter: MissionListFilter): Promise<readonly MissionRecord[]>
}

function cloneState(state: MissionState): MissionState {
  // States are flat — a shallow object spread is enough to guard against
  // callers mutating the value after putting it. Splitting per kind keeps
  // TypeScript happy on the discriminated union.
  switch (state.kind) {
    case 'Pending':
      return { kind: 'Pending', createdAt: state.createdAt }
    case 'Running':
      return { kind: 'Running', startedAt: state.startedAt }
    case 'Paused':
      return { kind: 'Paused', at: state.at, reason: state.reason }
    case 'Awaiting':
      return { kind: 'Awaiting', at: state.at, prompt: state.prompt }
    case 'Completed':
      return { kind: 'Completed', at: state.at, output: state.output }
    case 'Failed':
      return { kind: 'Failed', at: state.at, reason: state.reason }
    case 'Cancelled':
      return { kind: 'Cancelled', at: state.at, reason: state.reason }
  }
}

function cloneRecord(record: MissionRecord): MissionRecord {
  return { id: record.id, state: cloneState(record.state) }
}

export class InMemoryMissionStore implements MissionStore {
  private readonly map = new Map<MissionId, MissionRecord>()

  async get(id: MissionId): Promise<MissionRecord | undefined> {
    const r = this.map.get(id)
    return r ? cloneRecord(r) : undefined
  }

  async put(record: MissionRecord): Promise<void> {
    this.map.set(record.id, cloneRecord(record))
  }

  async delete(id: MissionId): Promise<boolean> {
    return this.map.delete(id)
  }

  async list(filter: MissionListFilter): Promise<readonly MissionRecord[]> {
    const kinds = filter.kinds
    const out: MissionRecord[] = []
    for (const record of this.map.values()) {
      if (!kinds || kinds.includes(record.state.kind)) {
        out.push(cloneRecord(record))
      }
    }
    return out
  }
}
