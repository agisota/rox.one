/**
 * Pure-function coverage for the M.2 T232 audit-log reducer.
 *
 * The reducer is the seam between the renderer (which is intentionally
 * thin and largely presentational) and the audit substrate that T246
 * already populates server-side. Locking the reducer down with
 * `bun:test` keeps the panel deterministic without booting React or
 * the DOM.
 */
import { describe, expect, test } from 'bun:test'
import type { AuditEvent } from '@rox-one/shared/observability'
import {
  actorIdentity,
  auditLogReducer,
  createInitialAuditLogState,
  DEFAULT_AUDIT_PAGE_SIZE,
  dayKey,
  EMPTY_AUDIT_FILTERS,
  eventMatchesFilters,
  selectActorCount,
  selectAuditLogView,
  type AuditLogState,
} from '../audit-log-state'

function makeEvent(overrides: Partial<AuditEvent> = {}): AuditEvent {
  return {
    kind: 'RoleGranted',
    ts: '2026-05-13T12:00:00.000Z',
    correlationId: '00000000-0000-0000-0000-000000000000' as AuditEvent['correlationId'],
    actor: { type: 'user', id: 'alice' },
    subject: { type: 'role', id: 'editor' },
    scope: { kind: 'global' },
    roleName: 'Editor',
    ...overrides,
  } as AuditEvent
}

describe('createInitialAuditLogState', () => {
  test('defaults page size and applies an empty filter set', () => {
    const state = createInitialAuditLogState()
    expect(state.pageSize).toBe(DEFAULT_AUDIT_PAGE_SIZE)
    expect(state.events).toEqual([])
    expect(state.page).toBe(0)
    expect(state.status).toBe('loading')
    expect(state.filters).toEqual(EMPTY_AUDIT_FILTERS)
  })

  test('honours overrides for tests and SSR pre-seeding', () => {
    const event = makeEvent()
    const state = createInitialAuditLogState({
      pageSize: 5,
      initialEvents: [event],
      initialStatus: 'ready',
      initialFilters: { kind: 'MissionFailed', actorQuery: 'bob' },
    })
    expect(state.pageSize).toBe(5)
    expect(state.events).toHaveLength(1)
    expect(state.status).toBe('ready')
    expect(state.filters.kind).toBe('MissionFailed')
    expect(state.filters.actorQuery).toBe('bob')
    // Bounds default to null even when partially overridden.
    expect(state.filters.from).toBeNull()
    expect(state.filters.to).toBeNull()
  })

  test('clamps non-positive page size to the default', () => {
    expect(createInitialAuditLogState({ pageSize: 0 }).pageSize).toBe(
      DEFAULT_AUDIT_PAGE_SIZE,
    )
    expect(createInitialAuditLogState({ pageSize: -10 }).pageSize).toBe(
      DEFAULT_AUDIT_PAGE_SIZE,
    )
  })
})

describe('actorIdentity / dayKey helpers', () => {
  test('actorIdentity covers user / system / service shapes', () => {
    expect(actorIdentity(makeEvent({ actor: { type: 'user', id: 'alice' } }))).toBe(
      'user:alice',
    )
    expect(actorIdentity(makeEvent({ actor: { type: 'system' } }))).toBe('system')
    expect(
      actorIdentity(makeEvent({ actor: { type: 'service', id: 'scheduler' } })),
    ).toBe('service:scheduler')
  })

  test('dayKey normalises non-UTC timestamps to UTC calendar day', () => {
    // 02:30 UTC on 2026-05-14 — verifying both the trim and the parser path.
    expect(dayKey('2026-05-14T02:30:00.000Z')).toBe('2026-05-14')
    // A `+02:00` timestamp at midnight local resolves to the previous UTC day.
    expect(dayKey('2026-05-14T01:30:00.000+02:00')).toBe('2026-05-13')
  })

  test('dayKey falls back to the literal prefix on unparseable input', () => {
    // 'not-a-date' is 10 chars and slice(0, 10) returns the whole string.
    expect(dayKey('not-a-date')).toBe('not-a-date')
    // True garbage (not even Date-coercible) trims to the first 10 chars.
    expect(dayKey('!!!totally-invalid-input!!!')).toBe('!!!totally')
  })
})

describe('eventMatchesFilters', () => {
  const baseFilters = EMPTY_AUDIT_FILTERS

  test('kind filter is an equality check; null = any', () => {
    const event = makeEvent({ kind: 'RoleGranted' })
    expect(eventMatchesFilters(event, baseFilters)).toBe(true)
    expect(eventMatchesFilters(event, { ...baseFilters, kind: 'RoleGranted' })).toBe(
      true,
    )
    expect(eventMatchesFilters(event, { ...baseFilters, kind: 'RoleRevoked' })).toBe(
      false,
    )
  })

  test('actorQuery is a case-insensitive substring match', () => {
    const event = makeEvent({ actor: { type: 'user', id: 'ALICE' } })
    expect(eventMatchesFilters(event, { ...baseFilters, actorQuery: 'ali' })).toBe(
      true,
    )
    expect(eventMatchesFilters(event, { ...baseFilters, actorQuery: 'bob' })).toBe(
      false,
    )
  })

  test('range filter applies inclusive ISO bounds on either side', () => {
    const event = makeEvent({ ts: '2026-05-13T12:00:00.000Z' })
    expect(
      eventMatchesFilters(event, {
        ...baseFilters,
        from: '2026-05-13T00:00:00.000Z',
        to: '2026-05-13T23:59:59.999Z',
      }),
    ).toBe(true)
    expect(
      eventMatchesFilters(event, {
        ...baseFilters,
        from: '2026-05-14T00:00:00.000Z',
        to: null,
      }),
    ).toBe(false)
    expect(
      eventMatchesFilters(event, {
        ...baseFilters,
        from: null,
        to: '2026-05-12T23:59:59.999Z',
      }),
    ).toBe(false)
  })
})

describe('auditLogReducer', () => {
  function withEvents(events: AuditEvent[], pageSize = 25): AuditLogState {
    return createInitialAuditLogState({
      initialEvents: events,
      initialStatus: 'ready',
      pageSize,
    })
  }

  test('refresh / events-loaded / load-failed walk the status machine', () => {
    const initial = createInitialAuditLogState()
    const refreshed = auditLogReducer(initial, { type: 'refresh' })
    expect(refreshed.status).toBe('loading')

    const event = makeEvent()
    const loaded = auditLogReducer(refreshed, {
      type: 'events-loaded',
      events: [event],
    })
    expect(loaded.status).toBe('ready')
    expect(loaded.events).toEqual([event])
    expect(loaded.page).toBe(0)

    const failed = auditLogReducer(loaded, {
      type: 'load-failed',
      error: 'boom',
    })
    expect(failed.status).toBe('error')
    expect(failed.error).toBe('boom')
  })

  test('events-loaded copies the input array (no aliasing)', () => {
    const initial = createInitialAuditLogState({ initialStatus: 'ready' })
    const events = [makeEvent()]
    const next = auditLogReducer(initial, { type: 'events-loaded', events })
    expect(next.events).not.toBe(events)
    expect(next.events).toEqual(events)
  })

  test('every filter mutation resets the page back to 0', () => {
    const eventsList = Array.from({ length: 60 }, (_, i) =>
      makeEvent({
        ts: `2026-05-${String(13 - (i % 13)).padStart(2, '0')}T00:00:0${i % 10}.000Z`,
        correlationId: `c-${i}` as AuditEvent['correlationId'],
      }),
    )
    let state = withEvents(eventsList, 10)
    state = auditLogReducer(state, { type: 'set-page', page: 2 })
    expect(state.page).toBe(2)
    state = auditLogReducer(state, { type: 'set-kind', kind: 'RoleGranted' })
    expect(state.page).toBe(0)
    state = auditLogReducer(state, { type: 'set-page', page: 3 })
    state = auditLogReducer(state, { type: 'set-actor-query', actorQuery: 'al' })
    expect(state.page).toBe(0)
    state = auditLogReducer(state, { type: 'set-page', page: 1 })
    state = auditLogReducer(
      state,
      { type: 'set-range', from: '2026-05-01T00:00:00.000Z', to: null },
    )
    expect(state.page).toBe(0)
  })

  test('reset-filters returns to EMPTY_AUDIT_FILTERS', () => {
    let state = createInitialAuditLogState({
      initialFilters: {
        kind: 'MissionStarted',
        actorQuery: 'alice',
        from: '2026-05-01T00:00:00.000Z',
        to: '2026-05-14T00:00:00.000Z',
      },
    })
    state = auditLogReducer(state, { type: 'reset-filters' })
    expect(state.filters).toEqual(EMPTY_AUDIT_FILTERS)
    expect(state.page).toBe(0)
  })

  test('set-page floors negative inputs to 0', () => {
    const state = auditLogReducer(createInitialAuditLogState(), {
      type: 'set-page',
      page: -3,
    })
    expect(state.page).toBe(0)
  })

  test('unknown action types return the same state reference', () => {
    const initial = createInitialAuditLogState()
    const next = auditLogReducer(initial, { type: 'made-up' } as unknown as never)
    expect(next).toBe(initial)
  })
})

describe('selectAuditLogView', () => {
  test('sorts newest-first across the same day and across days', () => {
    const earlier = makeEvent({
      ts: '2026-05-13T08:00:00.000Z',
      correlationId: 'c-earlier' as AuditEvent['correlationId'],
    })
    const later = makeEvent({
      ts: '2026-05-13T18:00:00.000Z',
      correlationId: 'c-later' as AuditEvent['correlationId'],
    })
    const yesterday = makeEvent({
      ts: '2026-05-12T23:59:59.000Z',
      correlationId: 'c-yesterday' as AuditEvent['correlationId'],
    })
    const state = createInitialAuditLogState({
      initialEvents: [earlier, yesterday, later],
      initialStatus: 'ready',
    })
    const view = selectAuditLogView(state)
    expect(view.groups.map(g => g.day)).toEqual(['2026-05-13', '2026-05-12'])
    expect(view.groups[0]!.events.map(e => String(e.correlationId))).toEqual([
      'c-later',
      'c-earlier',
    ])
    expect(view.groups[1]!.events).toHaveLength(1)
  })

  test('applies the active filters before pagination + grouping', () => {
    const granted = makeEvent({ kind: 'RoleGranted' })
    const revoked = makeEvent({
      kind: 'RoleRevoked',
      ts: '2026-05-13T13:00:00.000Z',
      correlationId: 'c-revoked' as AuditEvent['correlationId'],
    } as Partial<AuditEvent>)
    let state = createInitialAuditLogState({
      initialEvents: [granted, revoked],
      initialStatus: 'ready',
    })
    state = auditLogReducer(state, { type: 'set-kind', kind: 'RoleRevoked' })
    const view = selectAuditLogView(state)
    expect(view.totalFiltered).toBe(1)
    expect(view.groups[0]!.events[0]!.kind).toBe('RoleRevoked')
  })

  test('paginates and clamps the requested page', () => {
    const events: AuditEvent[] = Array.from({ length: 7 }, (_, i) =>
      makeEvent({
        ts: `2026-05-13T0${i}:00:00.000Z`,
        correlationId: `c-${i}` as AuditEvent['correlationId'],
      }),
    )
    let state = createInitialAuditLogState({
      initialEvents: events,
      initialStatus: 'ready',
      pageSize: 3,
    })
    state = auditLogReducer(state, { type: 'set-page', page: 1 })
    const second = selectAuditLogView(state)
    expect(second.totalPages).toBe(3)
    expect(second.page).toBe(1)
    expect(second.groups[0]!.events).toHaveLength(3)

    // Clamp: requesting a page past the end falls back to the last page.
    state = auditLogReducer(state, { type: 'set-page', page: 42 })
    const last = selectAuditLogView(state)
    expect(last.page).toBe(2)
    expect(last.groups[0]!.events).toHaveLength(1)
  })

  test('empty input still yields a single, empty page', () => {
    const view = selectAuditLogView(createInitialAuditLogState())
    expect(view.totalFiltered).toBe(0)
    expect(view.totalPages).toBe(1)
    expect(view.groups).toEqual([])
  })
})

describe('selectActorCount', () => {
  test('counts distinct identities across user/system/service', () => {
    const events = [
      makeEvent({ actor: { type: 'user', id: 'alice' } }),
      makeEvent({ actor: { type: 'user', id: 'alice' } }),
      makeEvent({ actor: { type: 'user', id: 'bob' } }),
      makeEvent({ actor: { type: 'system' } }),
      makeEvent({ actor: { type: 'service', id: 'scheduler' } }),
    ]
    const state = createInitialAuditLogState({
      initialEvents: events,
      initialStatus: 'ready',
    })
    expect(selectActorCount(state)).toBe(4)
  })

  test('returns 0 for an empty event list', () => {
    expect(selectActorCount(createInitialAuditLogState())).toBe(0)
  })
})
