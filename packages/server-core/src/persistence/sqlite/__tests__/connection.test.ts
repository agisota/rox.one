import { describe, expect, it } from 'bun:test'

import { openSqliteAdapter, readPragma } from '../connection'

describe('openSqliteAdapter', () => {
  it('opens an in-memory database with foreign_keys and synchronous pragmas applied', () => {
    const handle = openSqliteAdapter({ path: ':memory:' })

    expect(handle.path).toBe(':memory:')
    expect(readPragma(handle.db, 'foreign_keys')).toBe('1')
    expect(readPragma(handle.db, 'synchronous')).toBe('1')

    // :memory: cannot enter WAL — pragma should reflect 'memory'.
    expect(readPragma(handle.db, 'journal_mode')).toBe('memory')

    handle.close()
  })

  it('applies WAL on a file-backed database', () => {
    const tmpPath = `${process.env.TMPDIR ?? '/tmp'}/rox-m6-conn-${Date.now()}-${Math.random().toString(36).slice(2)}.db`
    const handle = openSqliteAdapter({ path: tmpPath })

    expect(readPragma(handle.db, 'journal_mode')).toBe('wal')
    expect(readPragma(handle.db, 'foreign_keys')).toBe('1')

    handle.close()
  })

  it('honors a custom busy_timeout', () => {
    const handle = openSqliteAdapter({ path: ':memory:', busyTimeoutMs: 1234 })
    expect(readPragma(handle.db, 'busy_timeout')).toBe('1234')
    handle.close()
  })

  it('rejects an empty path with a TypeError', () => {
    expect(() => openSqliteAdapter({ path: '' })).toThrow(TypeError)
  })

  it('close() is idempotent', () => {
    const handle = openSqliteAdapter({ path: ':memory:' })
    handle.close()
    // Second close must not throw.
    expect(() => handle.close()).not.toThrow()
  })
})
