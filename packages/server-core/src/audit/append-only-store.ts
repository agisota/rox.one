/**
 * WT-08 — Append-only contract for AuditEvent storage (A08-02).
 *
 * Defines the read-only/append-only interface that downstream WT-18 SQLite /
 * ClickHouse persistent impls will satisfy. The `InMemoryContractAuditStore`
 * is the default impl for tests + the Foundation wave; production backends
 * land in WT-18. No `update` / `delete` methods on the interface by design.
 *
 * NOTE: This is the contract-level store (uses `AuditEventContract` from the
 * shared audit-event schema). The legacy `InMemoryAuditEventStore` /
 * `FileAuditEventStore` from `@rox-one/shared/audit` remains the production
 * fanout target for `appendAuditEvent`; this contract store is the wire
 * format query target for WT-18.
 */
import {
  AuditEventSchema,
  INITIAL_AUDIT_PREV_HASH,
  computeContractAuditEventHash,
  type AuditEventContract,
} from '@rox-one/shared/audit'

export interface AppendOnlyAuditStore {
  append(event: AuditEventContract): void
  getAll(): readonly AuditEventContract[]
  getByEventId(eventId: string): AuditEventContract | undefined
  verifyChain(): VerifyChainResult
}

export interface VerifyChainResult {
  ok: boolean
  brokenAt?: string
  reason?: 'prev_hash_mismatch' | 'hash_mismatch'
}

export class InMemoryContractAuditStore implements AppendOnlyAuditStore {
  private readonly records: AuditEventContract[] = []
  private readonly byEventId = new Map<string, AuditEventContract>()

  append(event: AuditEventContract): void {
    AuditEventSchema.parse(event)
    if (this.byEventId.has(event.event_id)) {
      throw new Error(`duplicate audit event_id: ${event.event_id}`)
    }
    const expectedPrev = this.records.at(-1)?.hash ?? INITIAL_AUDIT_PREV_HASH
    if (event.prev_hash !== expectedPrev) {
      throw new Error(
        `audit prev_hash mismatch for ${event.event_id}: expected ${expectedPrev}, got ${event.prev_hash}`,
      )
    }
    const cloned: AuditEventContract = { ...event }
    this.records.push(cloned)
    this.byEventId.set(cloned.event_id, cloned)
  }

  getAll(): readonly AuditEventContract[] {
    return this.records.map(r => ({ ...r }))
  }

  getByEventId(eventId: string): AuditEventContract | undefined {
    const record = this.byEventId.get(eventId)
    return record ? { ...record } : undefined
  }

  verifyChain(): VerifyChainResult {
    return verifyContractAuditChain(this.records)
  }
}

export function verifyContractAuditChain(
  records: readonly AuditEventContract[],
): VerifyChainResult {
  let prev = INITIAL_AUDIT_PREV_HASH
  for (const record of records) {
    if (record.prev_hash !== prev) {
      return { ok: false, brokenAt: record.event_id, reason: 'prev_hash_mismatch' }
    }
    const { hash, ...canonical } = record
    const recomputed = computeContractAuditEventHash(canonical)
    if (recomputed !== hash) {
      return { ok: false, brokenAt: record.event_id, reason: 'hash_mismatch' }
    }
    prev = hash
  }
  return { ok: true }
}

/**
 * Test-only namespace — provides destructive helpers (clear, replace) so
 * production code paths never see update/delete on the public interface.
 */
export const __auditStoreTestHelpers = {
  clear(store: InMemoryContractAuditStore): void {
    ;(store as unknown as { records: AuditEventContract[]; byEventId: Map<string, AuditEventContract> })
      .records.length = 0
    ;(store as unknown as { byEventId: Map<string, AuditEventContract> }).byEventId.clear()
  },
  tamper(
    store: InMemoryContractAuditStore,
    eventId: string,
    mutator: (event: AuditEventContract) => AuditEventContract,
  ): void {
    const internal = store as unknown as {
      records: AuditEventContract[]
      byEventId: Map<string, AuditEventContract>
    }
    const index = internal.records.findIndex(r => r.event_id === eventId)
    if (index < 0) throw new Error(`unknown event_id for tamper: ${eventId}`)
    const tampered = mutator({ ...internal.records[index]! })
    internal.records[index] = tampered
    internal.byEventId.set(tampered.event_id, tampered)
  },
}
