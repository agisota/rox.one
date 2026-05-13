/**
 * Tests for `createHostAuditProducer` — host-side composition root that
 * assembles `StructuredLogger + FileAuditSink + AuditProducer + retention`.
 *
 * Exercised end-to-end against the real `FileAuditSink` under a per-test
 * temp dir LOCAL to cwd (never `/tmp` / `$HOME`) plus an injected clock.
 * A stub `createFileSink` covers dispose call ordering directly.
 */
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'

import {
  type AuditEvent,
  type AuditEventInput,
  type LogRecord,
  asCorrelationId,
} from '@rox-one/shared/observability'

import { type FileAuditSinkHandle } from '../file-audit-sink.ts'
import {
  DEFAULT_HOST_LOG_DIR_NAME,
  DEFAULT_HOST_LOG_FILE_NAME,
  DEFAULT_HOST_MAX_AGE_MS,
  DEFAULT_HOST_MAX_FILES,
  createHostAuditProducer,
} from '../host.ts'

const TEMP_ROOT = resolve(process.cwd(), '.tmp-test-host-audit-producer')
const FIXED = (): Date => new Date('2026-05-14T12:00:00.000Z')

function makeInput(overrides: Partial<AuditEvent> = {}): AuditEventInput {
  return {
    kind: 'RoleGranted',
    actor: { type: 'user', id: 'admin' },
    subject: { type: 'user', id: 'u-1' },
    scope: { kind: 'workspace', workspaceId: 'ws-1' },
    roleName: 'editor',
    ts: '2026-05-14T12:00:00.000Z',
    correlationId: asCorrelationId('cid-host-1'),
    ...overrides,
  } as AuditEventInput
}

function readLines(path: string): string[] {
  if (!existsSync(path)) return []
  const body = readFileSync(path, 'utf8')
  return body.length === 0 ? [] : body.split('\n').filter((l) => l.length > 0)
}

interface StubSinkHandle {
  handle: FileAuditSinkHandle; events: AuditEvent[]
  flushed: number; retentionRuns: number; closed: boolean
  flushShouldThrow: boolean; retentionShouldThrow: boolean
}

function makeStubFileSink(path: string): StubSinkHandle {
  const s: StubSinkHandle = {
    events: [], flushed: 0, retentionRuns: 0, closed: false,
    flushShouldThrow: false, retentionShouldThrow: false,
    handle: undefined as unknown as FileAuditSinkHandle,
  }
  s.handle = {
    sink: (e): void => { s.events.push(e) },
    flush: async (): Promise<void> => {
      s.flushed += 1; if (s.flushShouldThrow) throw new Error('flush boom')
    },
    close: async (): Promise<void> => { s.closed = true },
    activePath: (): string => path,
    enforceRetentionNow: () => {
      s.retentionRuns += 1
      if (s.retentionShouldThrow) throw new Error('retention boom')
      return { deleted: [], kept: [] }
    },
  }
  return s
}

describe('createHostAuditProducer', () => {
  let workDir: string

  beforeEach(() => {
    if (!existsSync(TEMP_ROOT)) mkdirSync(TEMP_ROOT, { recursive: true })
    workDir = mkdtempSync(join(TEMP_ROOT, 'run-'))
  })
  afterEach(() => {
    if (existsSync(workDir)) rmSync(workDir, { recursive: true, force: true })
  })

  it('builds the producer + sink + logger chain end-to-end', async () => {
    const logs: LogRecord[] = []
    const chain = createHostAuditProducer({ logDir: workDir, clock: FIXED, logSink: (r) => logs.push(r) })
    expect(chain.producer).toBeDefined()
    expect(typeof chain.producer.emit).toBe('function')
    expect(typeof chain.dispose).toBe('function')
    expect(chain.activeLogPath).toBe(join(workDir, DEFAULT_HOST_LOG_FILE_NAME))
    expect(chain.logger).toBeDefined()
    chain.producer.emit(makeInput())
    await chain.dispose()
    const lines = readLines(chain.activeLogPath)
    expect(lines).toHaveLength(1)
    const ev = JSON.parse(lines[0] ?? '{}') as AuditEvent
    expect(ev.kind).toBe('RoleGranted')
    expect(ev.correlationId).toBe(asCorrelationId('cid-host-1'))
  })

  it('emits to both the file sink and the structured logger', async () => {
    const logs: LogRecord[] = []
    const chain = createHostAuditProducer({ logDir: workDir, clock: FIXED, logSink: (r) => logs.push(r) })
    chain.producer.emit(makeInput())
    await chain.dispose()
    expect(readLines(chain.activeLogPath)).toHaveLength(1)
    const auditLog = logs.find((r) => r.message === 'audit.RoleGranted')
    expect(auditLog?.level).toBe('info')
    expect(auditLog?.fields.kind).toBe('RoleGranted')
    expect(auditLog?.fields.correlationId).toBe(asCorrelationId('cid-host-1'))
  })

  it('fan-outs to extra sinks alongside the file sink', async () => {
    const inMemory: AuditEvent[] = []
    const chain = createHostAuditProducer({ logDir: workDir, clock: FIXED, sinks: [(e) => inMemory.push(e)] })
    chain.producer.emit(makeInput())
    chain.producer.emit(makeInput({ correlationId: asCorrelationId('cid-2') }))
    await chain.dispose()
    expect(inMemory).toHaveLength(2)
    expect(readLines(chain.activeLogPath)).toHaveLength(2)
    expect(inMemory[0]?.correlationId).toBe(asCorrelationId('cid-host-1'))
    expect(inMemory[1]?.correlationId).toBe(asCorrelationId('cid-2'))
  })

  it('isolates a throwing extra sink: file sink still wins, error logged', async () => {
    const logs: LogRecord[] = []
    const chain = createHostAuditProducer({
      logDir: workDir, clock: FIXED, logSink: (r) => logs.push(r),
      sinks: [() => { throw new Error('boom') }],
    })
    expect(() => chain.producer.emit(makeInput())).not.toThrow()
    await chain.dispose()
    expect(readLines(chain.activeLogPath)).toHaveLength(1)
    const errLog = logs.find((r) => r.message === 'audit.extraSinkError')
    expect(errLog?.level).toBe('error')
    expect(errLog?.fields.kind).toBe('RoleGranted')
  })

  it('dispose() flushes pending writes then closes the file handle', async () => {
    const stub = makeStubFileSink(join(workDir, DEFAULT_HOST_LOG_FILE_NAME))
    const chain = createHostAuditProducer({ logDir: workDir, clock: FIXED, createFileSink: () => stub.handle })
    chain.producer.emit(makeInput())
    expect(stub.events).toHaveLength(1)
    expect(stub.flushed).toBe(0)
    expect(stub.closed).toBe(false)
    await chain.dispose()
    expect(stub.flushed).toBe(1)
    expect(stub.retentionRuns).toBe(1)
    expect(stub.closed).toBe(true)
  })

  it('dispose() is idempotent across multiple calls', async () => {
    const stub = makeStubFileSink(join(workDir, DEFAULT_HOST_LOG_FILE_NAME))
    const chain = createHostAuditProducer({ logDir: workDir, clock: FIXED, createFileSink: () => stub.handle })
    await chain.dispose()
    await chain.dispose()
    await chain.dispose()
    expect(stub.flushed).toBe(1)
    expect(stub.retentionRuns).toBe(1)
  })

  it('dispose() tolerates a throwing flush and continues to close', async () => {
    const logs: LogRecord[] = []
    const stub = makeStubFileSink(join(workDir, DEFAULT_HOST_LOG_FILE_NAME))
    stub.flushShouldThrow = true
    const chain = createHostAuditProducer({ logDir: workDir, clock: FIXED, logSink: (r) => logs.push(r), createFileSink: () => stub.handle })
    await chain.dispose()
    expect(stub.closed).toBe(true)
    expect(logs.find((r) => r.message === 'audit.flushError')?.level).toBe('error')
  })

  it('dispose() tolerates a throwing retention sweep and continues to close', async () => {
    const logs: LogRecord[] = []
    const stub = makeStubFileSink(join(workDir, DEFAULT_HOST_LOG_FILE_NAME))
    stub.retentionShouldThrow = true
    const chain = createHostAuditProducer({ logDir: workDir, clock: FIXED, logSink: (r) => logs.push(r), createFileSink: () => stub.handle })
    await chain.dispose()
    expect(stub.closed).toBe(true)
    expect(logs.find((r) => r.message === 'audit.retentionError')?.level).toBe('error')
  })

  it('threads retention options into the FileAuditSink factory', async () => {
    const captured: { maxAgeMs: number; maxFiles: number } = { maxAgeMs: -1, maxFiles: -1 }
    const stub = makeStubFileSink(join(workDir, DEFAULT_HOST_LOG_FILE_NAME))
    const chain = createHostAuditProducer({
      logDir: workDir, clock: FIXED,
      retention: { maxAgeMs: 7 * 24 * 60 * 60 * 1000, maxFiles: 14 },
      createFileSink: (args) => { captured.maxAgeMs = args.maxAgeMs; captured.maxFiles = args.maxFiles; return stub.handle },
    })
    chain.producer.emit(makeInput())
    await chain.dispose()
    expect(captured.maxAgeMs).toBe(7 * 24 * 60 * 60 * 1000)
    expect(captured.maxFiles).toBe(14)
  })

  it('falls back to default retention defaults when no policy supplied', () => {
    const captured: { maxAgeMs: number; maxFiles: number } = { maxAgeMs: -1, maxFiles: -1 }
    const stub = makeStubFileSink(join(workDir, DEFAULT_HOST_LOG_FILE_NAME))
    createHostAuditProducer({
      logDir: workDir, clock: FIXED,
      createFileSink: (args) => { captured.maxAgeMs = args.maxAgeMs; captured.maxFiles = args.maxFiles; return stub.handle },
    })
    expect(captured.maxAgeMs).toBe(DEFAULT_HOST_MAX_AGE_MS)
    expect(captured.maxFiles).toBe(DEFAULT_HOST_MAX_FILES)
    expect(DEFAULT_HOST_MAX_AGE_MS).toBe(90 * 24 * 60 * 60 * 1000)
    expect(DEFAULT_HOST_MAX_FILES).toBe(60)
  })

  it('defaults logDir to ${homedir()}/.rox when not supplied', () => {
    const home = join(workDir, 'fake-home')
    mkdirSync(home, { recursive: true })
    let capturedPath = ''
    const expected = join(home, DEFAULT_HOST_LOG_DIR_NAME, DEFAULT_HOST_LOG_FILE_NAME)
    const stub = makeStubFileSink(expected)
    const chain = createHostAuditProducer({
      homedir: () => home, clock: FIXED,
      createFileSink: (args) => { capturedPath = args.path; return stub.handle },
    })
    expect(capturedPath).toBe(expected)
    expect(chain.activeLogPath).toBe(expected)
  })

  it('enforceRetentionNow forwards to the file-sink handle', () => {
    const stub = makeStubFileSink(join(workDir, DEFAULT_HOST_LOG_FILE_NAME))
    const chain = createHostAuditProducer({ logDir: workDir, clock: FIXED, createFileSink: () => stub.handle })
    chain.enforceRetentionNow()
    chain.enforceRetentionNow()
    expect(stub.retentionRuns).toBe(2)
  })

  it('producer.emit stamps ts + correlationId when omitted by caller', async () => {
    const chain = createHostAuditProducer({ logDir: workDir, clock: () => new Date('2026-05-14T12:34:56.000Z') })
    const ev = chain.producer.emit({
      kind: 'LoginSucceeded', actor: { type: 'user', id: 'admin' },
      subject: { type: 'user', id: 'u-1' }, scope: { kind: 'global' },
    })
    await chain.dispose()
    expect(ev.ts).toBe('2026-05-14T12:34:56.000Z')
    expect(typeof ev.correlationId).toBe('string')
    expect(ev.correlationId.length).toBeGreaterThan(0)
  })

  it('emits multiple events in order through to the file sink', async () => {
    const chain = createHostAuditProducer({ logDir: workDir, clock: FIXED })
    chain.producer.emit(makeInput({ correlationId: asCorrelationId('a') }))
    chain.producer.emit(makeInput({ correlationId: asCorrelationId('b') }))
    chain.producer.emit(makeInput({ correlationId: asCorrelationId('c') }))
    await chain.dispose()
    const lines = readLines(chain.activeLogPath)
    expect(lines).toHaveLength(3)
    const ids = lines.map((l) => (JSON.parse(l) as AuditEvent).correlationId)
    expect(ids).toEqual([asCorrelationId('a'), asCorrelationId('b'), asCorrelationId('c')])
  })

  it('escalates LoginFailed → warn and MissionFailed → error in the log', async () => {
    const logs: LogRecord[] = []
    const chain = createHostAuditProducer({ logDir: workDir, clock: FIXED, logSink: (r) => logs.push(r) })
    chain.producer.emit({ kind: 'LoginFailed', actor: { type: 'system' }, subject: { type: 'user', id: 'u-1' }, scope: { kind: 'global' }, reason: 'bp' } as AuditEventInput)
    chain.producer.emit({ kind: 'MissionFailed', actor: { type: 'user', id: 'admin' }, subject: { type: 'mission', id: 'm-1' }, scope: { kind: 'mission', workspaceId: 'ws-1', missionId: 'm-1' }, missionId: 'm-1', errorMessage: 'oops' } as AuditEventInput)
    await chain.dispose()
    expect(logs.find((r) => r.message === 'audit.LoginFailed')?.level).toBe('warn')
    expect(logs.find((r) => r.message === 'audit.MissionFailed')?.level).toBe('error')
  })

  it('writes NDJSON: one JSON object per line, newline-terminated', async () => {
    const chain = createHostAuditProducer({ logDir: workDir, clock: FIXED })
    chain.producer.emit(makeInput({ correlationId: asCorrelationId('ndjson-1') }))
    chain.producer.emit(makeInput({ correlationId: asCorrelationId('ndjson-2') }))
    await chain.dispose()
    const raw = readFileSync(chain.activeLogPath, 'utf8')
    expect(raw.endsWith('\n')).toBe(true)
    const lines = raw.split('\n').filter((l) => l.length > 0)
    expect(lines).toHaveLength(2)
    for (const line of lines) expect(() => JSON.parse(line)).not.toThrow()
  })

  it('exposes the structured logger so hosts can log around emits', async () => {
    const logs: LogRecord[] = []
    const chain = createHostAuditProducer({ logDir: workDir, clock: FIXED, logSink: (r) => logs.push(r) })
    chain.logger.info('host.bootstrap', { component: 'rbac' })
    await chain.dispose()
    expect(logs.find((r) => r.message === 'host.bootstrap')?.fields.component).toBe('rbac')
  })

  it('drops log records when no logSink is supplied (production default)', () => {
    const stub = makeStubFileSink(join(workDir, DEFAULT_HOST_LOG_FILE_NAME))
    const chain = createHostAuditProducer({ logDir: workDir, clock: FIXED, createFileSink: () => stub.handle })
    expect(() => chain.producer.emit(makeInput())).not.toThrow()
    expect(stub.events).toHaveLength(1)
  })
})
