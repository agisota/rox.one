import { describe, expect, it } from 'bun:test'

import { asCorrelationId, withCorrelationId } from '../correlation.ts'
import { type AuditEvent, type AuditEventInput } from '../audit-event.ts'
import { type AuditProducer, type AuditSink, createAuditProducer } from '../audit-producer.ts'
import { type LogRecord, type LogSink, createStructuredLogger } from '../structured-logger.ts'

const FIXED_NOW = new Date('2026-05-13T12:00:00.000Z')
const fixedClock = (): Date => FIXED_NOW

function memorySink(): { records: AuditEvent[]; sink: AuditSink } {
  const records: AuditEvent[] = []
  return {
    records,
    sink: event => {
      records.push(event)
    },
  }
}

function memoryLogSink(): { records: LogRecord[]; sink: LogSink } {
  const records: LogRecord[] = []
  return {
    records,
    sink: record => {
      records.push(record)
    },
  }
}

function makeProducer(): {
  producer: AuditProducer
  audit: AuditEvent[]
  logs: LogRecord[]
} {
  const audit = memorySink()
  const logs = memoryLogSink()
  const logger = createStructuredLogger({ sink: logs.sink, threshold: 'trace', clock: fixedClock })
  const producer = createAuditProducer({ sink: audit.sink, logger, clock: fixedClock })
  return { producer, audit: audit.records, logs: logs.records }
}

const roleGrantedInput: AuditEventInput = {
  kind: 'RoleGranted',
  actor: { type: 'user', id: 'admin' },
  subject: { type: 'user', id: 'u-1' },
  scope: { kind: 'workspace', workspaceId: 'ws-1' },
  roleName: 'editor',
}

describe('createAuditProducer', () => {
  it('emit(): writes a normalised AuditEvent to the audit sink', () => {
    const { producer, audit } = makeProducer()

    producer.emit(roleGrantedInput)

    expect(audit).toHaveLength(1)
    const event = audit[0]
    expect(event).toBeDefined()
    expect(event?.kind).toBe('RoleGranted')
    expect(event?.ts).toBe(FIXED_NOW.toISOString())
  })

  it('emit(): stamps the active correlation id', () => {
    const { producer, audit } = makeProducer()

    withCorrelationId(asCorrelationId('span-1'), () => {
      producer.emit(roleGrantedInput)
    })

    expect(audit[0]?.correlationId).toBe(asCorrelationId('span-1'))
  })

  it('emit(): falls back to a synthesised correlation id when none is active', () => {
    const { producer, audit } = makeProducer()
    producer.emit(roleGrantedInput)

    const cid = audit[0]?.correlationId
    expect(typeof cid).toBe('string')
    expect((cid ?? '').length).toBeGreaterThan(0)
  })

  it('emit(): accepts an explicit correlationId override in the input', () => {
    const { producer, audit } = makeProducer()
    producer.emit({ ...roleGrantedInput, correlationId: asCorrelationId('explicit') })
    expect(audit[0]?.correlationId).toBe(asCorrelationId('explicit'))
  })

  it('emit(): accepts an explicit ts override in the input', () => {
    const { producer, audit } = makeProducer()
    const ts = '2025-01-01T00:00:00.000Z'
    producer.emit({ ...roleGrantedInput, ts })
    expect(audit[0]?.ts).toBe(ts)
  })

  it('emit(): fans the event out to the structured logger at info level', () => {
    const { producer, logs } = makeProducer()
    producer.emit(roleGrantedInput)

    expect(logs).toHaveLength(1)
    expect(logs[0]?.level).toBe('info')
    expect(logs[0]?.message).toBe('audit.RoleGranted')
    const fields = logs[0]?.fields ?? {}
    expect(fields.kind).toBe('RoleGranted')
    expect(fields.actor).toEqual({ type: 'user', id: 'admin' })
  })

  it('emit(): logs LoginFailed at warn level (security signal)', () => {
    const { producer, logs } = makeProducer()
    producer.emit({
      kind: 'LoginFailed',
      actor: { type: 'user', id: 'alice' },
      subject: { type: 'user', id: 'alice' },
      scope: { kind: 'global' },
      reason: 'bad-password',
    })

    expect(logs[0]?.level).toBe('warn')
  })

  it('emit(): logs MissionFailed at error level', () => {
    const { producer, logs } = makeProducer()
    producer.emit({
      kind: 'MissionFailed',
      actor: { type: 'system' },
      subject: { type: 'mission', id: 'm-1' },
      scope: { kind: 'workspace', workspaceId: 'ws-1' },
      missionId: 'm-1',
      errorMessage: 'tool unreachable',
    })

    expect(logs[0]?.level).toBe('error')
  })

  it('emit(): rejects inputs that fail validation', () => {
    const { producer } = makeProducer()

    expect(() => producer.emit({ ...roleGrantedInput, kind: 'NotAKind' as never })).toThrow(
      /unknown audit event kind/i,
    )
    expect(() =>
      producer.emit({
        ...roleGrantedInput,
        actor: { type: 'user', id: '' },
      }),
    ).toThrow(/actor/i)
  })

  it('emit(): swallows audit-sink throws without dropping the log fan-out', () => {
    const logs = memoryLogSink()
    const logger = createStructuredLogger({
      sink: logs.sink,
      threshold: 'trace',
      clock: fixedClock,
    })
    const producer = createAuditProducer({
      sink: () => {
        throw new Error('audit-store-down')
      },
      logger,
      clock: fixedClock,
    })

    expect(() => producer.emit(roleGrantedInput)).not.toThrow()
    expect(logs.records).toHaveLength(2)
    const failureLog = logs.records.find(r => r.message === 'audit.sinkError')
    expect(failureLog?.level).toBe('error')
  })

  it('emit(): returns the normalised event for caller chaining', () => {
    const { producer } = makeProducer()
    const event = producer.emit(roleGrantedInput)
    expect(event.kind).toBe('RoleGranted')
    expect(event.ts).toBe(FIXED_NOW.toISOString())
  })

  it('producer is correlation-aware end-to-end across await', async () => {
    const { producer, audit, logs } = makeProducer()

    await withCorrelationId(asCorrelationId('await-span'), async () => {
      await Promise.resolve()
      producer.emit(roleGrantedInput)
    })

    expect(audit[0]?.correlationId).toBe(asCorrelationId('await-span'))
    expect(logs[0]?.correlationId).toBe(asCorrelationId('await-span'))
  })

  it('emit(): produces deterministic events when correlation + ts are explicit', () => {
    const { producer, audit } = makeProducer()
    const ts = '2026-01-01T00:00:00.000Z'
    const cid = asCorrelationId('determ')

    producer.emit({ ...roleGrantedInput, correlationId: cid, ts })
    producer.emit({ ...roleGrantedInput, correlationId: cid, ts })

    expect(audit).toHaveLength(2)
    expect(audit[0]).toEqual(audit[1] as AuditEvent)
  })
})
