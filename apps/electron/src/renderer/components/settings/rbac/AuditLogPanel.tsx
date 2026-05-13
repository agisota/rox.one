/**
 * AuditLogPanel — read-only audit-event surface introduced by M.2 T232.
 *
 * T246 (already on `main`) wired `AuditProducer.emit` into the RBAC
 * admin handlers and the mission scheduler so an append-only,
 * hash-chained log accumulates server-side. T232 adds the consumer:
 * a settings page that lets an admin scrub the log with three filters
 * (event kind, actor substring, time range) and walk it page by page.
 *
 * The panel is transport-agnostic — it consumes an `AuditEventSource`
 * via React context. In production the page wrapper supplies a
 * source backed by the renderer transport; in tests we inject the
 * in-memory implementation below.
 *
 * Note: the RPC handler that materialises events for the renderer is
 * tracked separately as T232b. For T232 the source contract is the
 * single boundary; nothing in this file talks to `window.electronAPI`.
 */

import * as React from 'react'
import type { AuditEvent, AuditEventKind } from '@rox-one/shared/observability'
import { AUDIT_EVENT_KINDS } from '@rox-one/shared/observability'
import { SettingsCard, SettingsSection } from '@/components/settings'
import {
  actorIdentity,
  auditLogReducer,
  createInitialAuditLogState,
  selectActorCount,
  selectAuditLogView,
  type AuditLogState,
} from './audit-log-state'

/**
 * The single seam between the panel and the audit substrate.
 *
 * `list()` returns the events visible to the caller (server-side ACL
 * is enforced by the future T232b handler). The interface stays this
 * narrow so we can land the panel + tests without coupling to RPC.
 */
export interface AuditEventSource {
  list(): Promise<AuditEvent[]>
}

export interface AuditLogPanelContextValue {
  source: AuditEventSource
  /** Initial state override for tests / SSR. */
  initialState?: Partial<AuditLogState>
}

export const AuditLogPanelContext = React.createContext<AuditLogPanelContextValue | null>(null)

export function useAuditLogPanelContext(): AuditLogPanelContextValue {
  const value = React.useContext(AuditLogPanelContext)
  if (!value) {
    throw new Error(
      'AuditLogPanelContext is missing — wrap AuditLogPanel in an AuditLogPanelContext.Provider',
    )
  }
  return value
}

export interface AuditLogPanelProps {
  /**
   * Optional pre-seeded state. Tests and SSR use this; the production
   * renderer omits it and lets the panel fetch on mount.
   */
  initialState?: Partial<AuditLogState>
}

/** Convenience in-memory `AuditEventSource` used by tests. */
export function createInMemoryAuditEventSource(
  events: AuditEvent[],
): AuditEventSource {
  const snapshot = events.slice()
  return {
    async list(): Promise<AuditEvent[]> {
      return snapshot.slice()
    },
  }
}

function mergeInitialState(
  base: AuditLogState,
  override: Partial<AuditLogState> | undefined,
): AuditLogState {
  if (!override) return base
  return {
    ...base,
    status: override.status ?? base.status,
    events: override.events ?? base.events,
    error: override.error ?? base.error,
    filters: override.filters ?? base.filters,
    page: override.page ?? base.page,
    pageSize: override.pageSize ?? base.pageSize,
  }
}

export function AuditLogPanel({
  initialState,
}: AuditLogPanelProps = {}): React.ReactElement {
  const { source, initialState: ctxInitialState } = useAuditLogPanelContext()
  const seedOverride = initialState ?? ctxInitialState

  const seed = React.useMemo(
    () => mergeInitialState(createInitialAuditLogState(), seedOverride),
    [seedOverride],
  )

  const [state, dispatch] = React.useReducer(auditLogReducer, seed)

  const loadAll = React.useCallback(async () => {
    dispatch({ type: 'refresh' })
    try {
      const events = await source.list()
      dispatch({
        type: 'events-loaded',
        events: Array.isArray(events) ? events : [],
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      dispatch({ type: 'load-failed', error: message })
    }
  }, [source])

  // Skip auto-load when callers pre-seed deterministic state (tests
  // and the future SSR path).
  React.useEffect(() => {
    if (seedOverride && seedOverride.status) return
    void loadAll()
  }, [seedOverride, loadAll])

  if (state.status === 'loading') {
    return (
      <section data-rbac-audit-state="loading" className="space-y-3">
        <SettingsCard className="px-4 py-3.5">
          <p className="text-sm text-muted-foreground">Loading audit log…</p>
        </SettingsCard>
      </section>
    )
  }

  if (state.status === 'error') {
    return (
      <section data-rbac-audit-state="error" className="space-y-3">
        <SettingsCard className="px-4 py-3.5">
          <p className="text-sm text-destructive">
            Failed to load audit log: {state.error ?? 'unknown error'}
          </p>
        </SettingsCard>
      </section>
    )
  }

  const view = selectAuditLogView(state)
  const actorCount = selectActorCount(state)

  return (
    <section
      data-rbac-audit-state="ready"
      data-rbac-audit-actor-count={actorCount}
      data-rbac-audit-total={view.totalFiltered}
      className="space-y-6"
    >
      <SettingsSection
        title="Filters"
        description="Narrow the log by kind, actor identity, or time range."
      >
        <SettingsCard className="px-4 py-3.5 space-y-3">
          <AuditLogFilterControls state={state} dispatch={dispatch} />
        </SettingsCard>
      </SettingsSection>

      <SettingsSection
        title="Events"
        description={
          view.totalFiltered === 0
            ? 'No audit events match the current filters.'
            : `${view.totalFiltered} event${view.totalFiltered === 1 ? '' : 's'} match the current filters.`
        }
      >
        <SettingsCard divided>
          {view.groups.length === 0 ? (
            <div
              className="px-4 py-3.5 text-sm text-muted-foreground"
              data-rbac-audit-empty="true"
            >
              No events to display.
            </div>
          ) : (
            view.groups.map(group => (
              <AuditDayGroupRow key={group.day} day={group.day} events={group.events} />
            ))
          )}
        </SettingsCard>

        <AuditLogPagination view={view} dispatch={dispatch} />
      </SettingsSection>
    </section>
  )
}

interface AuditLogFilterControlsProps {
  state: AuditLogState
  dispatch: React.Dispatch<Parameters<typeof auditLogReducer>[1]>
}

function AuditLogFilterControls({
  state,
  dispatch,
}: AuditLogFilterControlsProps): React.ReactElement {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        <span>Kind</span>
        <select
          data-rbac-audit-filter="kind"
          className="rounded border border-input bg-background px-2 py-1.5 text-sm"
          value={state.filters.kind ?? ''}
          onChange={event => {
            const next = event.target.value as AuditEventKind | ''
            dispatch({ type: 'set-kind', kind: next === '' ? null : next })
          }}
        >
          <option value="">All kinds</option>
          {AUDIT_EVENT_KINDS.map(kind => (
            <option key={kind} value={kind}>
              {kind}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        <span>Actor</span>
        <input
          type="search"
          data-rbac-audit-filter="actor"
          className="rounded border border-input bg-background px-2 py-1.5 text-sm"
          value={state.filters.actorQuery}
          placeholder="user:alice"
          onChange={event =>
            dispatch({ type: 'set-actor-query', actorQuery: event.target.value })
          }
        />
      </label>

      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        <span>From</span>
        <input
          type="datetime-local"
          data-rbac-audit-filter="from"
          className="rounded border border-input bg-background px-2 py-1.5 text-sm"
          value={toLocalInput(state.filters.from)}
          onChange={event =>
            dispatch({
              type: 'set-range',
              from: fromLocalInput(event.target.value),
              to: state.filters.to,
            })
          }
        />
      </label>

      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        <span>To</span>
        <input
          type="datetime-local"
          data-rbac-audit-filter="to"
          className="rounded border border-input bg-background px-2 py-1.5 text-sm"
          value={toLocalInput(state.filters.to)}
          onChange={event =>
            dispatch({
              type: 'set-range',
              from: state.filters.from,
              to: fromLocalInput(event.target.value),
            })
          }
        />
      </label>

      <div className="sm:col-span-2 lg:col-span-4 flex justify-end">
        <button
          type="button"
          data-rbac-audit-filter="reset"
          className="text-xs underline text-muted-foreground hover:text-foreground"
          onClick={() => dispatch({ type: 'reset-filters' })}
        >
          Reset filters
        </button>
      </div>
    </div>
  )
}

interface AuditDayGroupRowProps {
  day: string
  events: AuditEvent[]
}

function AuditDayGroupRow({
  day,
  events,
}: AuditDayGroupRowProps): React.ReactElement {
  return (
    <div data-rbac-audit-day={day} className="px-4 py-3.5 space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {formatDayHeader(day)}
      </h4>
      <ul className="space-y-2">
        {events.map(event => (
          <AuditEventRow
            key={`${event.correlationId}:${event.ts}:${event.kind}`}
            event={event}
          />
        ))}
      </ul>
    </div>
  )
}

interface AuditEventRowProps {
  event: AuditEvent
}

function AuditEventRow({ event }: AuditEventRowProps): React.ReactElement {
  return (
    <li
      data-rbac-audit-event-kind={event.kind}
      className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm"
    >
      <span className="font-mono text-xs text-muted-foreground">
        {formatTime(event.ts)}
      </span>
      <span className="font-medium">{event.kind}</span>
      <span className="text-muted-foreground">
        by <span data-rbac-audit-event-actor={actorIdentity(event)}>
          {actorIdentity(event)}
        </span>
      </span>
      <span className="text-muted-foreground">→ {describeSubject(event)}</span>
    </li>
  )
}

interface AuditLogPaginationProps {
  view: ReturnType<typeof selectAuditLogView>
  dispatch: React.Dispatch<Parameters<typeof auditLogReducer>[1]>
}

function AuditLogPagination({
  view,
  dispatch,
}: AuditLogPaginationProps): React.ReactElement | null {
  if (view.totalPages <= 1) return null
  const canPrev = view.page > 0
  const canNext = view.page < view.totalPages - 1
  return (
    <div
      data-rbac-audit-pagination="true"
      className="flex items-center justify-between text-xs text-muted-foreground"
    >
      <span>
        Page {view.page + 1} of {view.totalPages}
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          data-rbac-audit-pagination-prev="true"
          disabled={!canPrev}
          onClick={() => dispatch({ type: 'set-page', page: view.page - 1 })}
          className="rounded border border-input px-2 py-1 disabled:opacity-50"
        >
          Previous
        </button>
        <button
          type="button"
          data-rbac-audit-pagination-next="true"
          disabled={!canNext}
          onClick={() => dispatch({ type: 'set-page', page: view.page + 1 })}
          className="rounded border border-input px-2 py-1 disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  )
}

function describeSubject(event: AuditEvent): string {
  const subject = event.subject
  return `${subject.type}:${subject.id}`
}

function formatTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toISOString().slice(11, 19)
}

function formatDayHeader(day: string): string {
  // The grouping key is already a `YYYY-MM-DD` string; renderers can
  // localise it later, but for now we display the canonical ISO form
  // alongside the time-of-day in each row.
  return day
}

function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  // `datetime-local` expects `YYYY-MM-DDTHH:mm`.
  return date.toISOString().slice(0, 16)
}

function fromLocalInput(value: string): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}
