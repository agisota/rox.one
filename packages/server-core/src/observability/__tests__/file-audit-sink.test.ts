/**
 * Tests for `FileAuditSink` — NDJSON writer for audit events with daily +
 * size-based rotation.
 *
 * The sink is exercised against the real filesystem (under a per-test
 * temp dir LOCAL to the test cwd, never `/tmp`) plus an injected clock so
 * rotation triggers are deterministic.
 */
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

import {
  type AuditEvent,
  asCorrelationId,
} from '@rox-one/shared/observability'

import { createFileAuditSink, type FileAuditSinkHandle } from '../file-audit-sink.ts'

const TEMP_ROOT = resolve(process.cwd(), '.tmp-test-file-audit-sink')

function makeEvent(overrides: Partial<AuditEvent> = {}): AuditEvent {
  const base: AuditEvent = {
    kind: 'RoleGranted',
    ts: '2026-05-14T12:00:00.000Z',
    correlationId: asCorrelationId('cid-1'),
    actor: { type: 'user', id: 'admin' },
    subject: { type: 'user', id: 'u-1' },
    scope: { kind: 'workspace', workspaceId: 'ws-1' },
    roleName: 'editor',
  }
  return { ...base, ...overrides } as AuditEvent
}

function flush(handle: FileAuditSinkHandle): Promise<void> {
  return handle.flush()
}

function readLines(path: string): string[] {
  if (!existsSync(path)) return []
  const body = readFileSync(path, 'utf8')
  if (body.length === 0) return []
  return body.split('\n').filter((line) => line.length > 0)
}

describe('FileAuditSink', () => {
  let workDir: string

  beforeEach(() => {
    if (!existsSync(TEMP_ROOT)) {
      mkdirSync(TEMP_ROOT, { recursive: true })
    }
    workDir = mkdtempSync(join(TEMP_ROOT, 'run-'))
  })

  afterEach(() => {
    if (existsSync(workDir)) {
      rmSync(workDir, { recursive: true, force: true })
    }
  })

  it('creates the log file on first write', async () => {
    const path = join(workDir, 'audit.log')
    const sink = createFileAuditSink({ path, clock: () => new Date('2026-05-14T12:00:00.000Z') })

    sink.sink(makeEvent())
    await flush(sink)

    expect(existsSync(path)).toBe(true)
  })

  it('writes NDJSON: one JSON object per line, newline-terminated', async () => {
    const path = join(workDir, 'audit.log')
    const sink = createFileAuditSink({ path, clock: () => new Date('2026-05-14T12:00:00.000Z') })

    sink.sink(makeEvent({ correlationId: asCorrelationId('a') }))
    sink.sink(makeEvent({ correlationId: asCorrelationId('b') }))
    await flush(sink)

    const lines = readLines(path)
    expect(lines).toHaveLength(2)
    const first = JSON.parse(lines[0] ?? '{}') as AuditEvent
    const second = JSON.parse(lines[1] ?? '{}') as AuditEvent
    expect(first.correlationId).toBe(asCorrelationId('a'))
    expect(second.correlationId).toBe(asCorrelationId('b'))
  })

  it('preserves the canonical event shape (kind/actor/subject/scope/ts)', async () => {
    const path = join(workDir, 'audit.log')
    const sink = createFileAuditSink({ path, clock: () => new Date('2026-05-14T12:00:00.000Z') })

    sink.sink(makeEvent())
    await flush(sink)

    const line = readLines(path)[0]
    expect(line).toBeDefined()
    const event = JSON.parse(line ?? '{}') as AuditEvent
    expect(event.kind).toBe('RoleGranted')
    expect(event.ts).toBe('2026-05-14T12:00:00.000Z')
    expect(event.actor).toEqual({ type: 'user', id: 'admin' })
    expect(event.subject).toEqual({ type: 'user', id: 'u-1' })
    expect(event.scope).toEqual({ kind: 'workspace', workspaceId: 'ws-1' })
  })

  it('appends across multiple emit batches (no truncation)', async () => {
    const path = join(workDir, 'audit.log')
    const sink = createFileAuditSink({ path, clock: () => new Date('2026-05-14T12:00:00.000Z') })

    sink.sink(makeEvent({ correlationId: asCorrelationId('1') }))
    await flush(sink)
    sink.sink(makeEvent({ correlationId: asCorrelationId('2') }))
    sink.sink(makeEvent({ correlationId: asCorrelationId('3') }))
    await flush(sink)

    const lines = readLines(path)
    expect(lines).toHaveLength(3)
    expect((JSON.parse(lines[0] ?? '{}') as AuditEvent).correlationId).toBe(asCorrelationId('1'))
    expect((JSON.parse(lines[2] ?? '{}') as AuditEvent).correlationId).toBe(asCorrelationId('3'))
  })

  it('appends to a pre-existing file from today (no rotate on same date)', async () => {
    const path = join(workDir, 'audit.log')
    const seed = makeEvent({ ts: '2026-05-14T08:00:00.000Z' })
    writeFileSync(path, JSON.stringify(seed) + '\n', 'utf8')

    const sink = createFileAuditSink({ path, clock: () => new Date('2026-05-14T18:00:00.000Z') })
    sink.sink(makeEvent({ correlationId: asCorrelationId('after') }))
    await flush(sink)

    const lines = readLines(path)
    expect(lines).toHaveLength(2)
    expect(readdirSync(workDir).filter((f) => f.startsWith('audit-')).length).toBe(0)
  })

  it('rotates when the file head date does not match today (daily rotation)', async () => {
    const path = join(workDir, 'audit.log')
    const yesterdayEvent = makeEvent({ ts: '2026-05-13T20:00:00.000Z' })
    writeFileSync(path, JSON.stringify(yesterdayEvent) + '\n', 'utf8')

    const sink = createFileAuditSink({ path, clock: () => new Date('2026-05-14T00:00:01.000Z') })
    sink.sink(makeEvent({ ts: '2026-05-14T00:00:01.000Z', correlationId: asCorrelationId('new-day') }))
    await flush(sink)

    const rotated = join(workDir, 'audit-2026-05-13.log')
    expect(existsSync(rotated)).toBe(true)
    const rotatedLines = readLines(rotated)
    expect(rotatedLines).toHaveLength(1)
    expect((JSON.parse(rotatedLines[0] ?? '{}') as AuditEvent).ts).toBe('2026-05-13T20:00:00.000Z')

    const currentLines = readLines(path)
    expect(currentLines).toHaveLength(1)
    expect((JSON.parse(currentLines[0] ?? '{}') as AuditEvent).correlationId).toBe(asCorrelationId('new-day'))
  })

  it('rotates using the UTC date even when the local clock differs', async () => {
    const path = join(workDir, 'audit.log')
    // First-line date is `2026-05-13` UTC, but the timestamp itself encodes a
    // local-time string with offset. We assert rotation triggers on the UTC
    // calendar day, not the offset-shifted local day.
    const lateEvent = makeEvent({ ts: '2026-05-13T23:30:00.000Z' })
    writeFileSync(path, JSON.stringify(lateEvent) + '\n', 'utf8')

    const sink = createFileAuditSink({ path, clock: () => new Date('2026-05-14T00:15:00.000Z') })
    sink.sink(makeEvent({ correlationId: asCorrelationId('post-utc-midnight') }))
    await flush(sink)

    expect(existsSync(join(workDir, 'audit-2026-05-13.log'))).toBe(true)
    expect(readLines(path)).toHaveLength(1)
  })

  it('rotates when the file size meets or exceeds the configured cap', async () => {
    const path = join(workDir, 'audit.log')
    // Pre-fill a large file from today so the cap is breached before our write.
    const filler = JSON.stringify(makeEvent({ ts: '2026-05-14T08:00:00.000Z' })) + '\n'
    writeFileSync(path, filler.repeat(40), 'utf8')

    const sink = createFileAuditSink({
      path,
      clock: () => new Date('2026-05-14T09:00:00.000Z'),
      maxSizeBytes: 256,
    })

    sink.sink(makeEvent({ correlationId: asCorrelationId('post-cap') }))
    await flush(sink)

    const rotatedFiles = readdirSync(workDir).filter((f) => f.startsWith('audit-2026-05-14'))
    expect(rotatedFiles.length).toBeGreaterThanOrEqual(1)
    const currentLines = readLines(path)
    expect(currentLines).toHaveLength(1)
    expect((JSON.parse(currentLines[0] ?? '{}') as AuditEvent).correlationId).toBe(asCorrelationId('post-cap'))
  })

  it('rotation does not lose events queued before the rotation point', async () => {
    const path = join(workDir, 'audit.log')
    const stale = makeEvent({ ts: '2026-05-13T08:00:00.000Z', correlationId: asCorrelationId('stale') })
    writeFileSync(path, JSON.stringify(stale) + '\n', 'utf8')

    const sink = createFileAuditSink({ path, clock: () => new Date('2026-05-14T01:00:00.000Z') })

    sink.sink(makeEvent({ correlationId: asCorrelationId('a') }))
    sink.sink(makeEvent({ correlationId: asCorrelationId('b') }))
    sink.sink(makeEvent({ correlationId: asCorrelationId('c') }))
    await flush(sink)

    const currentLines = readLines(path)
    expect(currentLines).toHaveLength(3)
    const ids = currentLines.map((l) => (JSON.parse(l) as AuditEvent).correlationId)
    expect(ids).toEqual([asCorrelationId('a'), asCorrelationId('b'), asCorrelationId('c')])

    const rotatedLines = readLines(join(workDir, 'audit-2026-05-13.log'))
    expect(rotatedLines).toHaveLength(1)
    expect((JSON.parse(rotatedLines[0] ?? '{}') as AuditEvent).correlationId).toBe(asCorrelationId('stale'))
  })

  it('creates the parent directory if missing', async () => {
    const nested = join(workDir, 'nested', 'logs')
    const path = join(nested, 'audit.log')
    expect(existsSync(nested)).toBe(false)

    const sink = createFileAuditSink({ path, clock: () => new Date('2026-05-14T12:00:00.000Z') })
    sink.sink(makeEvent())
    await flush(sink)

    expect(existsSync(path)).toBe(true)
    expect(readLines(path)).toHaveLength(1)
  })

  it('defaults the path to ${homedir()}/.rox/audit.log when not specified (via injected homedir)', async () => {
    const home = join(workDir, 'fake-home')
    mkdirSync(home, { recursive: true })

    const sink = createFileAuditSink({
      clock: () => new Date('2026-05-14T12:00:00.000Z'),
      homedir: () => home,
    })
    sink.sink(makeEvent())
    await flush(sink)

    const expected = join(home, '.rox', 'audit.log')
    expect(existsSync(expected)).toBe(true)
    expect(readLines(expected)).toHaveLength(1)
  })

  it('preserves discriminated-union extras (e.g. RoleGranted.roleName) round-trip', async () => {
    const path = join(workDir, 'audit.log')
    const sink = createFileAuditSink({ path, clock: () => new Date('2026-05-14T12:00:00.000Z') })

    sink.sink(makeEvent({ roleName: 'admin' } as Partial<AuditEvent>))
    await flush(sink)

    const event = JSON.parse(readLines(path)[0] ?? '{}') as AuditEvent & { roleName: string }
    expect(event.kind).toBe('RoleGranted')
    expect(event.roleName).toBe('admin')
  })

  it('close() flushes pending writes and rejects further events', async () => {
    const path = join(workDir, 'audit.log')
    const sink = createFileAuditSink({ path, clock: () => new Date('2026-05-14T12:00:00.000Z') })

    sink.sink(makeEvent({ correlationId: asCorrelationId('pre-close') }))
    await sink.close()

    expect(readLines(path)).toHaveLength(1)
    expect(() => sink.sink(makeEvent({ correlationId: asCorrelationId('post-close') }))).toThrow()
  })

  it('handles a corrupted/empty existing file by treating it as today (no rotate)', async () => {
    const path = join(workDir, 'audit.log')
    writeFileSync(path, '{garbage not json}\n', 'utf8')

    const sink = createFileAuditSink({ path, clock: () => new Date('2026-05-14T12:00:00.000Z') })
    sink.sink(makeEvent({ correlationId: asCorrelationId('after-corrupt') }))
    await flush(sink)

    const lines = readLines(path)
    expect(lines.length).toBeGreaterThanOrEqual(1)
    const last = JSON.parse(lines[lines.length - 1] ?? '{}') as AuditEvent
    expect(last.correlationId).toBe(asCorrelationId('after-corrupt'))
    expect(readdirSync(workDir).filter((f) => f.startsWith('audit-')).length).toBe(0)
  })

  it('disambiguates the rotated filename on collision by appending a sequence', async () => {
    const path = join(workDir, 'audit.log')
    // Existing rotated file from yesterday already present.
    writeFileSync(join(workDir, 'audit-2026-05-13.log'), 'prior\n', 'utf8')
    const yesterdayEvent = makeEvent({ ts: '2026-05-13T20:00:00.000Z' })
    writeFileSync(path, JSON.stringify(yesterdayEvent) + '\n', 'utf8')

    const sink = createFileAuditSink({ path, clock: () => new Date('2026-05-14T00:00:01.000Z') })
    sink.sink(makeEvent({ ts: '2026-05-14T00:00:01.000Z', correlationId: asCorrelationId('new') }))
    await flush(sink)

    const rotated = readdirSync(workDir).filter((f) => f.startsWith('audit-2026-05-13'))
    expect(rotated.length).toBeGreaterThanOrEqual(2)
  })

  it('writes are JSON-parseable for every emitted event (NDJSON shape invariant)', async () => {
    const path = join(workDir, 'audit.log')
    const sink = createFileAuditSink({ path, clock: () => new Date('2026-05-14T12:00:00.000Z') })

    for (let i = 0; i < 25; i++) {
      sink.sink(makeEvent({ correlationId: asCorrelationId(`bulk-${i}`) }))
    }
    await flush(sink)

    const lines = readLines(path)
    expect(lines).toHaveLength(25)
    for (const line of lines) {
      expect(() => JSON.parse(line)).not.toThrow()
    }
  })

  it('uses the configured `maxSizeBytes` default (10 MB) when not overridden', async () => {
    // We don't actually exercise the 10 MB cap; we just assert that with no
    // explicit cap and a small file, no size-rotation happens.
    const path = join(workDir, 'audit.log')
    const sink = createFileAuditSink({ path, clock: () => new Date('2026-05-14T12:00:00.000Z') })

    for (let i = 0; i < 10; i++) {
      sink.sink(makeEvent({ correlationId: asCorrelationId(`x-${i}`) }))
    }
    await flush(sink)

    expect(readdirSync(workDir).filter((f) => f.startsWith('audit-')).length).toBe(0)
    expect(readLines(path)).toHaveLength(10)
  })

  it('enforces retention after a rotation when retention is configured', async () => {
    const path = join(workDir, 'audit.log')
    const yesterday = makeEvent({ ts: '2026-05-13T20:00:00.000Z' })
    writeFileSync(path, JSON.stringify(yesterday) + '\n', 'utf8')
    // Pre-existing rotated file from way before the retention window.
    const stalePath = join(workDir, 'audit-2025-01-01.log')
    writeFileSync(stalePath, 'old\n', 'utf8')
    // Force the mtime well past the 30-day retention window.
    const oldEpoch = new Date('2025-01-01T00:00:00.000Z')
    utimesSync(stalePath, oldEpoch, oldEpoch)

    const sink = createFileAuditSink({
      path,
      clock: () => new Date('2026-05-14T00:00:01.000Z'),
      retention: { maxAgeMs: 30 * 24 * 60 * 60 * 1000, maxFiles: 60 },
    })
    sink.sink(makeEvent({ ts: '2026-05-14T00:00:01.000Z' }))
    await flush(sink)

    // Yesterday rotated → audit-2026-05-13.log exists; the 2025 stale file
    // is gone because retention swept it after the daily rotation.
    expect(existsSync(join(workDir, 'audit-2026-05-13.log'))).toBe(true)
    expect(existsSync(stalePath)).toBe(false)
  })

  it('enforceRetentionNow is a no-op when retention is not configured', () => {
    const path = join(workDir, 'audit.log')
    const sink = createFileAuditSink({ path, clock: () => new Date('2026-05-14T12:00:00.000Z') })
    const result = sink.enforceRetentionNow()
    expect(result.deleted).toEqual([])
    expect(result.kept).toEqual([])
  })
})
