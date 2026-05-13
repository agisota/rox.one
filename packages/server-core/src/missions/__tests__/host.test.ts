import { describe, expect, it } from 'bun:test'

import type { Database } from 'bun:sqlite'

import { openSqliteAdapter, type SqliteHandle } from '../../persistence/sqlite/connection.ts'
import { runMigrations, type RunMigrationsResult } from '../../persistence/sqlite/migrations.ts'
import {
  createMissionStore,
  type MissionStoreHandle,
} from '../host.ts'
import { unsafeMissionId } from '../mission-id.ts'
import { InMemoryMissionStore, type MissionRecord, type MissionStore } from '../mission-store.ts'
import { SqliteMissionStore } from '../sqlite-mission-store.ts'

const ID_A = unsafeMissionId('0192f6e1-2a8b-7c00-9c1f-0000000000aa')
const ID_B = unsafeMissionId('0192f6e1-2a8b-7c00-9c1f-0000000000bb')
const T0 = '2026-05-13T00:00:00.000Z'

function assertMissionStoreInterface(store: MissionStore): void {
  // Every method must be defined on the concrete instance. This is the
  // structural test that both backends implement the same contract.
  expect(typeof store.get).toBe('function')
  expect(typeof store.put).toBe('function')
  expect(typeof store.delete).toBe('function')
  expect(typeof store.list).toBe('function')
}

describe('createMissionStore — in-memory selection', () => {
  it('returns an InMemoryMissionStore when dbPath is undefined', () => {
    const handle = createMissionStore()
    expect(handle.backend).toBe('in-memory')
    expect(handle.dbPath).toBeUndefined()
    expect(handle.store).toBeInstanceOf(InMemoryMissionStore)
    assertMissionStoreInterface(handle.store)
    handle.dispose()
  })

  it('returns an InMemoryMissionStore when dbPath is the empty string', () => {
    const handle = createMissionStore({ dbPath: '' })
    expect(handle.backend).toBe('in-memory')
    expect(handle.dbPath).toBeUndefined()
    expect(handle.store).toBeInstanceOf(InMemoryMissionStore)
    handle.dispose()
  })

  it('dispose() is a no-op for the in-memory backend (safe to repeat)', () => {
    const handle = createMissionStore()
    expect(() => handle.dispose()).not.toThrow()
    expect(() => handle.dispose()).not.toThrow()
  })

  it('does not call the open or migrate hooks when dbPath is falsy', () => {
    let opened = 0
    let migrated = 0
    const handle = createMissionStore({
      dbPath: undefined,
      open: () => {
        opened += 1
        throw new Error('open() must not be called for the in-memory backend')
      },
      migrate: () => {
        migrated += 1
        return { applied: [], head: 0 }
      },
    })
    expect(opened).toBe(0)
    expect(migrated).toBe(0)
    expect(handle.backend).toBe('in-memory')
    handle.dispose()
  })

  it('round-trips a record through the in-memory store', async () => {
    const handle = createMissionStore()
    const rec: MissionRecord = { id: ID_A, state: { kind: 'Pending', createdAt: T0 } }
    await handle.store.put(rec)
    const got = await handle.store.get(ID_A)
    expect(got?.id).toBe(ID_A)
    expect(got?.state.kind).toBe('Pending')
    handle.dispose()
  })
})

describe('createMissionStore — sqlite selection', () => {
  it('returns a SqliteMissionStore for `:memory:`', () => {
    const handle = createMissionStore({ dbPath: ':memory:' })
    expect(handle.backend).toBe('sqlite')
    expect(handle.dbPath).toBe(':memory:')
    expect(handle.store).toBeInstanceOf(SqliteMissionStore)
    assertMissionStoreInterface(handle.store)
    handle.dispose()
  })

  it('applies the migration ledger so the missions table is queryable', async () => {
    const handle = createMissionStore({ dbPath: ':memory:' })
    // If migrations did not run, the very first put would throw because
    // the missions table would not exist.
    await handle.store.put({ id: ID_A, state: { kind: 'Pending', createdAt: T0 } })
    const got = await handle.store.get(ID_A)
    expect(got).toBeDefined()
    expect(got?.id).toBe(ID_A)
    handle.dispose()
  })

  it('forwards the injected clock to SqliteMissionStore', async () => {
    let stamps = 0
    const handle = createMissionStore({
      dbPath: ':memory:',
      now: () => {
        stamps += 1
        return T0
      },
    })
    await handle.store.put({ id: ID_A, state: { kind: 'Pending', createdAt: T0 } })
    expect(stamps).toBeGreaterThanOrEqual(1)
    handle.dispose()
  })

  it('list reads back what put wrote across two backends independently', async () => {
    const a = createMissionStore({ dbPath: ':memory:' })
    const b = createMissionStore({ dbPath: ':memory:' })
    await a.store.put({ id: ID_A, state: { kind: 'Pending', createdAt: T0 } })
    await b.store.put({ id: ID_B, state: { kind: 'Running', startedAt: T0 } })
    const listA = await a.store.list({})
    const listB = await b.store.list({})
    expect(listA).toHaveLength(1)
    expect(listB).toHaveLength(1)
    expect(listA[0]?.id).toBe(ID_A)
    expect(listB[0]?.id).toBe(ID_B)
    a.dispose()
    b.dispose()
  })
})

describe('createMissionStore — dependency injection + lifecycle', () => {
  it('uses the injected open + migrate hooks for the sqlite branch', () => {
    let opened = ''
    let migratedDb: Database | undefined
    let closed = 0
    const stubHandle: SqliteHandle = ((): SqliteHandle => {
      const real = openSqliteAdapter({ path: ':memory:' })
      return {
        db: real.db,
        path: ':memory:',
        close: () => {
          closed += 1
          real.close()
        },
      }
    })()
    const handle = createMissionStore({
      dbPath: '/tmp-never-read/missions.db',
      open: (path) => {
        opened = path
        return stubHandle
      },
      migrate: (db) => {
        migratedDb = db
        return runMigrations(db)
      },
    })
    expect(opened).toBe('/tmp-never-read/missions.db')
    expect(migratedDb).toBe(stubHandle.db)
    expect(handle.backend).toBe('sqlite')
    // dbPath comes from the handle the open() hook returned, not the
    // caller-supplied string — that's the contract documented on
    // MissionStoreHandle.dbPath.
    expect(handle.dbPath).toBe(':memory:')
    handle.dispose()
    expect(closed).toBe(1)
  })

  it('dispose() is idempotent and only closes the handle once', () => {
    let closed = 0
    const real = openSqliteAdapter({ path: ':memory:' })
    const stub: SqliteHandle = {
      db: real.db,
      path: real.path,
      close: () => {
        closed += 1
        real.close()
      },
    }
    const handle: MissionStoreHandle = createMissionStore({
      dbPath: ':memory:',
      open: () => stub,
      migrate: (db) => runMigrations(db),
    })
    handle.dispose()
    handle.dispose()
    handle.dispose()
    expect(closed).toBe(1)
  })

  it('migrate runs before the store sees the database', () => {
    const events: string[] = []
    const real = openSqliteAdapter({ path: ':memory:' })
    const stub: SqliteHandle = {
      db: real.db,
      path: real.path,
      close: () => {
        events.push('close')
        real.close()
      },
    }
    const result: RunMigrationsResult = { applied: [], head: 0 }
    const handle = createMissionStore({
      dbPath: ':memory:',
      open: () => {
        events.push('open')
        return stub
      },
      migrate: (db) => {
        events.push('migrate')
        return runMigrations(db) ?? result
      },
    })
    expect(events).toEqual(['open', 'migrate'])
    handle.dispose()
    expect(events).toEqual(['open', 'migrate', 'close'])
  })

  it('propagates open() failures without leaking a half-built handle', () => {
    expect(() =>
      createMissionStore({
        dbPath: '/anywhere',
        open: () => {
          throw new Error('boom')
        },
      }),
    ).toThrow(/boom/)
  })
})
