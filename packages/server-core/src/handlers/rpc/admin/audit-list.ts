/**
 * Admin RPC handler `audit.list` (M.14 T250-rpc).
 *
 * Paginated, owner-gated read surface over the M.1.5 audit-event store
 * (`@rox-one/shared/audit/AuditEventStorageBackend`). The handler closes
 * the consumer loop opened by T232 — that ticket landed the renderer
 * panel (`AuditLogPanel`) and an in-memory `AuditEventSource` stub; this
 * ticket adds the real RPC the renderer can hit.
 *
 * Contract:
 *  - **Owner-gate**: caller must hold a `global` owner grant. Audit
 *    records are cross-workspace and cross-tenant, so workspace-owner
 *    is intentionally NOT sufficient. The check reuses the canonical
 *    `rbacResolver.ownerGrantsForUser` pattern from `roles.ts`
 *    (`roles.create`) and `missions.ts` — no bespoke auth code.
 *  - **Input schema**: validated via Zod with strict mode. Unknown
 *    fields are rejected at the `z.object` boundary so renderer
 *    payload drift is caught at the server.
 *  - **Filters**: `eventType`, `actor` (matched against
 *    `record.actor.id`), `since` (inclusive lower bound),
 *    `until` (inclusive upper bound). All optional.
 *  - **Pagination**: opaque cursor. The cursor encodes `{ts, eventId}`
 *    as a URL-safe base64 string so the server can resume sorted
 *    iteration even when two records share a `ts`. The contents are
 *    not part of the wire contract — callers MUST treat the cursor
 *    as opaque and forward it verbatim. Forging the cursor (e.g.
 *    decoding then mutating `ts`) only changes which records the
 *    server skips; it cannot bypass the owner gate, filter, or limit
 *    cap because authorisation runs before the cursor is consulted.
 *  - **Limit**: clamped to `[1, 100]`. Default 25 to match the
 *    renderer reducer's `DEFAULT_AUDIT_PAGE_SIZE`.
 *  - **Sort**: most recent first (`ts DESC, eventId DESC`). Matches
 *    `queryAuditEventRecords`' canonical order so server-side and
 *    client-side sorters never diverge.
 *  - **Error envelope**: structured `{error, reason}` for all failure
 *    modes (auth, validation, missing-store, store-failure). Raw
 *    storage errors are wrapped so SQL/file-handle leakage cannot
 *    occur via the RPC.
 *
 * Optional dependency: hosts that have not wired the M.1.5 store may
 * omit `deps.auditEventStore`; the handler then responds with
 * `{error: 'audit-not-configured'}` so the renderer can show a
 * "log unavailable" hint without a hard failure.
 */

import { RPC_CHANNELS } from '@rox-one/shared/protocol'
import { z } from 'zod'
import type {
  AuditEventRecord,
  AuditEventStorageBackend,
} from '@rox-one/shared/audit'
import type { RpcServer } from '@rox-one/server-core/transport'

import type { HandlerDeps } from '../../handler-deps'
import type { RequestContext } from '../../../transport/types'

export const CORE_HANDLED_CHANNELS = [RPC_CHANNELS.audit.LIST] as const

/** Lowest legal page size — keeps tests honest about empty pages. */
const MIN_LIMIT = 1
/** Highest legal page size — caps wire payload size at ~100 records. */
const MAX_LIMIT = 100
/** Default page size — matches the renderer's `DEFAULT_AUDIT_PAGE_SIZE`. */
const DEFAULT_LIMIT = 25

/**
 * Strict Zod schema for the `audit.list` input envelope. `.strict()`
 * rejects unknown keys at every nesting level so renderer / client
 * drift is caught before the handler body runs.
 */
const auditListInputSchema = z
  .object({
    cursor: z.string().optional(),
    limit: z.number().int().min(MIN_LIMIT).max(MAX_LIMIT).default(DEFAULT_LIMIT),
    filter: z
      .object({
        action: z.string().optional(),
        actor: z.string().optional(),
        since: z.string().datetime().optional(),
        until: z.string().datetime().optional(),
      })
      .strict()
      .optional(),
  })
  .strict()

export type AuditListInput = z.infer<typeof auditListInputSchema>

/**
 * Output shape returned on the happy path. The renderer's
 * `audit-log-state` reducer consumes `entries` directly via the
 * `AuditEventSource` interface (after a thin adapter that maps
 * `AuditEventRecord` → `AuditEvent`, planned for T232c).
 */
export interface AuditListOk {
  ok: true
  entries: AuditEventRecord[]
  nextCursor: string | null
  totalCount: number
}

export interface AuditListError {
  error: string
  reason: string
}

export type AuditListResult = AuditListOk | AuditListError

interface CursorPayload {
  ts: string
  eventId: string
}

/**
 * Encode `{ts, eventId}` into a URL-safe base64 string. The contents
 * are server-controlled: callers never construct cursors from raw
 * timestamps, they only receive `nextCursor` from a prior response.
 */
function encodeCursor(payload: CursorPayload): string {
  const json = JSON.stringify(payload)
  // `Buffer.from(...).toString('base64url')` is Bun/Node native.
  return Buffer.from(json, 'utf8').toString('base64url')
}

/**
 * Decode an opaque cursor. Returns `null` for any decode/JSON/shape
 * failure so a forged cursor degrades to "start from the top" rather
 * than throwing — opaque-cursor semantics, not strict-parse.
 */
function decodeCursor(cursor: string): CursorPayload | null {
  try {
    const json = Buffer.from(cursor, 'base64url').toString('utf8')
    const parsed = JSON.parse(json) as unknown
    if (parsed === null || typeof parsed !== 'object') return null
    const v = parsed as Record<string, unknown>
    if (typeof v.ts !== 'string' || v.ts.length === 0) return null
    if (typeof v.eventId !== 'string' || v.eventId.length === 0) return null
    return { ts: v.ts, eventId: v.eventId }
  } catch {
    return null
  }
}

/**
 * Owner-gate: caller must be authenticated AND hold a `global` owner
 * grant. Mirrors the `roles.create` (global-only) admin gate.
 */
async function assertGlobalOwner(
  deps: HandlerDeps,
  ctx: RequestContext,
): Promise<AuditListError | null> {
  if (!ctx.userId) {
    return { error: 'permission-denied', reason: 'no-user' }
  }
  if (!deps.rbacResolver) {
    return { error: 'rbac-not-configured', reason: 'no-rbac-resolver' }
  }
  const ownerGrants = await deps.rbacResolver.ownerGrantsForUser(ctx.userId)
  const allowed = ownerGrants.some((grant) => grant.scopeKind === 'global')
  if (!allowed) {
    return { error: 'permission-denied', reason: 'no-owner-grant' }
  }
  return null
}

/**
 * Newest-first comparator on `(ts, eventId)`. Matches the canonical
 * order used by `queryAuditEventRecords` so server-side and
 * client-side sorters never diverge.
 */
function compareNewestFirst(left: AuditEventRecord, right: AuditEventRecord): number {
  const byTime = Date.parse(right.ts) - Date.parse(left.ts)
  if (byTime !== 0) return byTime
  return right.eventId.localeCompare(left.eventId)
}

/**
 * Apply filter predicates. Strings are matched by equality — substring
 * matching is intentionally left to the renderer reducer (`actorQuery`
 * in `audit-log-state.ts`) because doing it server-side would
 * forbid index pushdown in a future sqlite-backed adapter.
 */
function matchesFilter(
  record: AuditEventRecord,
  filter: { action?: string; actor?: string; since?: string; until?: string },
  sinceMs: number | null,
  untilMs: number | null,
): boolean {
  if (filter.action !== undefined && record.eventType !== filter.action) {
    return false
  }
  if (filter.actor !== undefined && record.actor.id !== filter.actor) {
    return false
  }
  const ts = Date.parse(record.ts)
  if (sinceMs !== null && ts < sinceMs) return false
  if (untilMs !== null && ts > untilMs) return false
  return true
}

/**
 * Cursor-window predicate: keep records strictly OLDER than the
 * cursor. Because the list is sorted newest-first, a strictly-older
 * record either has a smaller `ts` OR an equal `ts` and a
 * lexicographically smaller `eventId`. The strict-less semantics
 * guarantee the cursor record itself is consumed exactly once across
 * the two pages.
 */
function olderThanCursor(record: AuditEventRecord, cursor: CursorPayload): boolean {
  const recordTs = Date.parse(record.ts)
  const cursorTs = Date.parse(cursor.ts)
  if (recordTs < cursorTs) return true
  if (recordTs > cursorTs) return false
  return record.eventId.localeCompare(cursor.eventId) < 0
}

/**
 * Read all records from the store and apply filter + cursor + sort.
 * Wraps every store failure as `audit-store-error` so raw exceptions
 * never reach the RPC caller.
 */
async function readAndShape(
  store: AuditEventStorageBackend,
  filter: { action?: string; actor?: string; since?: string; until?: string },
  cursor: CursorPayload | null,
  limit: number,
): Promise<
  | { ok: true; entries: AuditEventRecord[]; nextCursor: string | null; totalCount: number }
  | AuditListError
> {
  let all: AuditEventRecord[]
  try {
    all = await store.listRecords()
  } catch {
    // Surface a stable error code; the underlying store may carry
    // SQL fragments or file paths in its native error and we do not
    // want those bubbling onto the wire.
    return { error: 'audit-store-error', reason: 'list-records-failed' }
  }

  const sinceMs = filter.since != null ? Date.parse(filter.since) : null
  const untilMs = filter.until != null ? Date.parse(filter.until) : null

  // Step 1: apply filters across the whole store so `totalCount`
  // reflects the filter-matched universe, not the cursor window.
  // This matches what a renderer expects: "23 events match these
  // filters; we're paging through them 25 at a time."
  const filtered = all.filter((record) =>
    matchesFilter(record, filter, sinceMs, untilMs),
  )
  filtered.sort(compareNewestFirst)

  // Step 2: apply the cursor window. Cursor + filter compose so a
  // narrowed filter on a later page still walks strictly-older records.
  const window = cursor === null
    ? filtered
    : filtered.filter((record) => olderThanCursor(record, cursor))

  // Step 3: slice to `limit + 1` so we can decide whether another
  // page exists without re-querying.
  const sliced = window.slice(0, limit + 1)
  const hasMore = sliced.length > limit
  const entries = hasMore ? sliced.slice(0, limit) : sliced

  const last = entries.at(-1)
  const nextCursor = hasMore && last
    ? encodeCursor({ ts: last.ts, eventId: last.eventId })
    : null

  return {
    ok: true,
    entries,
    nextCursor,
    totalCount: filtered.length,
  }
}

export function registerAuditAdminHandlers(server: RpcServer, deps: HandlerDeps): void {
  server.handle(
    RPC_CHANNELS.audit.LIST,
    async (ctx: RequestContext, raw: unknown): Promise<AuditListResult> => {
      // 1. Schema validation. Strict-mode Zod rejects unknown keys at
      //    every nesting level so renderer payload drift is caught
      //    before the auth check runs (matches the validation-before-
      //    auth ordering used by `roles.grant` and `missions.dispatch`).
      const parsed = auditListInputSchema.safeParse(raw ?? {})
      if (!parsed.success) {
        // First issue's path drives the `reason` so callers can pinpoint
        // the offending field without leaking the full Zod error tree.
        const issue = parsed.error.issues[0]
        const path = issue ? issue.path.join('.') : ''
        return {
          error: 'invalid-argument',
          reason: path.length > 0 ? `invalid-${path}` : 'invalid-input',
        }
      }
      const input: AuditListInput = parsed.data

      // 2. Owner-gate. Done AFTER schema validation so malformed
      //    payloads receive `invalid-argument` rather than masking
      //    them behind `permission-denied`. This matches the
      //    `missions.dispatchEvent` ordering.
      const denied = await assertGlobalOwner(deps, ctx)
      if (denied) return denied

      // 3. Storage check. The M.1.5 store is optional in HandlerDeps
      //    so hosts on the C.4 baseline path still load the handler
      //    bundle; only the runtime branch differs.
      if (!deps.auditEventStore) {
        return { error: 'audit-not-configured', reason: 'no-audit-event-store' }
      }

      // 4. Decode the opaque cursor. A forged / corrupt cursor degrades
      //    to "start from the top" — opaque-cursor semantics: callers
      //    cannot rely on the encoding so the server is free to
      //    silently restart on garbage input.
      const cursor = input.cursor !== undefined ? decodeCursor(input.cursor) : null

      const filter = input.filter ?? {}
      return readAndShape(deps.auditEventStore, filter, cursor, input.limit)
    },
  )
}
