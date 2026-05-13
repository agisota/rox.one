/**
 * Pure data layer for the Audit log surface (M.2 T232).
 *
 * T246 wired `AuditProducer.emit` into RBAC admin handlers and the
 * mission scheduler so a hash-chained event log accumulates as
 * operators bind roles and as missions run. T232 adds the consumer-
 * side surface: an admin reads the same log via a paginated,
 * filterable, day-grouped panel.
 *
 * The reducer + selectors here are pure (no React, no DOM, no I/O).
 * The renderer (`AuditLogPanel.tsx`) imports them and feeds the
 * panel via the `AuditEventSource` interface; a future T232b will
 * add the RPC handler, but for now tests + the in-memory source are
 * the single contract.
 *
 * Filter semantics:
 *   - `kind`        — equality on `AuditEvent.kind` (`null` = any).
 *   - `actorQuery`  — case-insensitive substring match against the
 *                     actor identity (`user:id`, `system`,
 *                     `service:id`); empty string = any.
 *   - `from` / `to` — inclusive ISO-8601 bounds on `event.ts`; `null`
 *                     = unbounded on that side.
 *
 * Grouping: events are bucketed by the `YYYY-MM-DD` UTC slice of
 * `event.ts`. Groups are ordered newest-day first; within each group,
 * events are ordered newest-event first. The result is stable: same
 * input → same output, regardless of insertion order.
 *
 * Pagination: the reducer carries `page` (0-indexed) and `pageSize`,
 * and `selectAuditLogView` slices the *flat* filtered list before the
 * day-grouping step so cross-day pages render predictable counts.
 */

import type { AuditEvent, AuditEventKind } from '@rox-one/shared/observability/audit-event'

export type AuditLogStatus = 'loading' | 'ready' | 'error'

export interface AuditLogFilters {
  /** Equality filter on `event.kind`. `null` = any kind. */
  kind: AuditEventKind | null
  /** Case-insensitive substring match against the actor identity. */
  actorQuery: string
  /** ISO timestamp (inclusive) lower bound. `null` = unbounded. */
  from: string | null
  /** ISO timestamp (inclusive) upper bound. `null` = unbounded. */
  to: string | null
}

export interface AuditLogState {
  status: AuditLogStatus
  /** All events the source has handed us. Append-only in practice. */
  events: AuditEvent[]
  /** Latest error message when `status === 'error'`. */
  error: string | null
  /** Active filters. */
  filters: AuditLogFilters
  /** 0-indexed page over the filtered list. */
  page: number
  /** Items per page (immutable for the lifetime of the panel). */
  pageSize: number
}

export type AuditLogAction =
  | { type: 'refresh' }
  | { type: 'events-loaded'; events: AuditEvent[] }
  | { type: 'load-failed'; error: string }
  | { type: 'set-kind'; kind: AuditEventKind | null }
  | { type: 'set-actor-query'; actorQuery: string }
  | { type: 'set-range'; from: string | null; to: string | null }
  | { type: 'reset-filters' }
  | { type: 'set-page'; page: number }

export interface AuditLogDayGroup {
  /** `YYYY-MM-DD` UTC date key. */
  day: string
  events: AuditEvent[]
}

export interface AuditLogView {
  /** Day-grouped events for the active page. */
  groups: AuditLogDayGroup[]
  /** Total events matching the active filters (across all pages). */
  totalFiltered: number
  /** Total pages — at least one even when `totalFiltered === 0`. */
  totalPages: number
  /** Echoes the requested page, clamped to `[0, totalPages - 1]`. */
  page: number
  /** Echoes `state.pageSize` for convenience. */
  pageSize: number
}

export const DEFAULT_AUDIT_PAGE_SIZE = 25

export const EMPTY_AUDIT_FILTERS: AuditLogFilters = {
  kind: null,
  actorQuery: '',
  from: null,
  to: null,
}

export interface CreateInitialAuditLogStateInput {
  pageSize?: number
  initialEvents?: AuditEvent[]
  initialStatus?: AuditLogStatus
  initialFilters?: Partial<AuditLogFilters>
}

/**
 * Build the initial reducer state. The host normally omits the
 * optional knobs; tests + the future SSR path use them to pre-seed
 * deterministic state without round-tripping through `refresh`.
 */
export function createInitialAuditLogState(
  input: CreateInitialAuditLogStateInput = {},
): AuditLogState {
  const pageSize = input.pageSize ?? DEFAULT_AUDIT_PAGE_SIZE
  return {
    status: input.initialStatus ?? 'loading',
    events: input.initialEvents ?? [],
    error: null,
    filters: { ...EMPTY_AUDIT_FILTERS, ...(input.initialFilters ?? {}) },
    page: 0,
    pageSize: pageSize > 0 ? pageSize : DEFAULT_AUDIT_PAGE_SIZE,
  }
}

/**
 * Pure reducer driving the audit-log panel state machine.
 *
 * Every filter mutation resets `page` to `0` so admins do not get
 * stranded on an empty page after narrowing the result set.
 */
export function auditLogReducer(
  state: AuditLogState,
  action: AuditLogAction,
): AuditLogState {
  switch (action.type) {
    case 'refresh':
      return { ...state, status: 'loading', error: null }
    case 'events-loaded':
      return {
        ...state,
        status: 'ready',
        events: action.events.slice(),
        error: null,
        page: 0,
      }
    case 'load-failed':
      return { ...state, status: 'error', error: action.error }
    case 'set-kind':
      return {
        ...state,
        filters: { ...state.filters, kind: action.kind },
        page: 0,
      }
    case 'set-actor-query':
      return {
        ...state,
        filters: { ...state.filters, actorQuery: action.actorQuery },
        page: 0,
      }
    case 'set-range':
      return {
        ...state,
        filters: {
          ...state.filters,
          from: action.from,
          to: action.to,
        },
        page: 0,
      }
    case 'reset-filters':
      return { ...state, filters: { ...EMPTY_AUDIT_FILTERS }, page: 0 }
    case 'set-page':
      return { ...state, page: action.page < 0 ? 0 : action.page }
    default:
      return state
  }
}

/**
 * Stable, human-readable identity for an actor — used both for the
 * UI chip and for the `actorQuery` filter.
 */
export function actorIdentity(event: AuditEvent): string {
  const actor = event.actor
  switch (actor.type) {
    case 'system':
      return 'system'
    case 'user':
      return `user:${actor.id}`
    case 'service':
      return `service:${actor.id}`
  }
}

/**
 * `YYYY-MM-DD` UTC day key derived from an ISO timestamp.
 *
 * We intentionally use the UTC calendar day rather than the renderer
 * timezone so two operators on different machines bucket events the
 * same way — the panel header still renders the day in the user's
 * locale via `Intl.DateTimeFormat`.
 */
export function dayKey(iso: string): string {
  // ISO-8601 timestamps with a `Z` suffix or fractional seconds slice
  // cleanly at the `T`. We use `Date#toISOString` as the canonical
  // normaliser so non-UTC inputs (e.g. `+02:00`) are converted to UTC
  // before slicing — that way two events at the same instant but with
  // different zone notations group together.
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    // Fall back to the literal prefix if the input is unparseable so
    // we never crash the renderer on a malformed event.
    return iso.slice(0, 10)
  }
  return date.toISOString().slice(0, 10)
}

/**
 * Predicate: does `event` satisfy the active filters?
 *
 * Exported so callers (and tests) can reuse the rule outside the
 * full reducer pipeline — e.g. to count "matches in the unseen
 * tail" without rebuilding the whole view.
 */
export function eventMatchesFilters(
  event: AuditEvent,
  filters: AuditLogFilters,
): boolean {
  if (filters.kind !== null && event.kind !== filters.kind) {
    return false
  }
  if (filters.actorQuery.length > 0) {
    const needle = filters.actorQuery.toLowerCase()
    if (!actorIdentity(event).toLowerCase().includes(needle)) {
      return false
    }
  }
  if (filters.from !== null && event.ts < filters.from) {
    return false
  }
  if (filters.to !== null && event.ts > filters.to) {
    return false
  }
  return true
}

function compareEventsDesc(a: AuditEvent, b: AuditEvent): number {
  if (a.ts !== b.ts) return a.ts < b.ts ? 1 : -1
  // Stable tiebreaker so two events at the same `ts` keep a deterministic
  // order across re-renders (correlationId is opaque but stringly-ordered).
  if (a.correlationId !== b.correlationId) {
    return a.correlationId < b.correlationId ? 1 : -1
  }
  return 0
}

/**
 * Filter, sort, paginate, then group the audit events. Pure: same
 * input → same output, no hidden state.
 */
export function selectAuditLogView(state: AuditLogState): AuditLogView {
  const matching = state.events.filter(event =>
    eventMatchesFilters(event, state.filters),
  )
  matching.sort(compareEventsDesc)

  const totalFiltered = matching.length
  const pageSize = state.pageSize
  const totalPages = totalFiltered === 0 ? 1 : Math.ceil(totalFiltered / pageSize)
  const page = Math.min(state.page, totalPages - 1)
  const start = page * pageSize
  const slice = matching.slice(start, start + pageSize)

  return {
    groups: groupByDay(slice),
    totalFiltered,
    totalPages,
    page,
    pageSize,
  }
}

/**
 * Number of distinct actor identities across the *unfiltered* event
 * list. Cheap and convenient for the panel header.
 */
export function selectActorCount(state: AuditLogState): number {
  const seen = new Set<string>()
  for (const event of state.events) {
    seen.add(actorIdentity(event))
  }
  return seen.size
}

function groupByDay(events: AuditEvent[]): AuditLogDayGroup[] {
  const byDay = new Map<string, AuditEvent[]>()
  for (const event of events) {
    const key = dayKey(event.ts)
    const bucket = byDay.get(key)
    if (bucket) {
      bucket.push(event)
    } else {
      byDay.set(key, [event])
    }
  }
  return Array.from(byDay.entries())
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([day, dayEvents]) => ({ day, events: dayEvents }))
}
