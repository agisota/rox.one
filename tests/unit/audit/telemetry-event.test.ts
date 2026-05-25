import { afterEach, beforeEach, describe, expect, it } from 'bun:test'

import {
  TelemetryEventSchema,
  __resetTelemetryCountersForTests,
  emitTelemetryEvent,
  getDroppedTelemetryAttributesCount,
  redactTelemetryAttributes,
  setAuditLoggerWarn,
  setTelemetrySink,
} from '../../../packages/shared/src/audit/index.ts'

describe('TelemetryEvent schema', () => {
  it('parses a valid event', () => {
    const valid = {
      ts: new Date().toISOString(),
      source: 'renderer',
      event: 'click',
      attributes: { surface: 'topbar', count: 1, ok: true },
    }
    expect(() => TelemetryEventSchema.parse(valid)).not.toThrow()
  })

  it('rejects uppercase source', () => {
    expect(() =>
      TelemetryEventSchema.parse({
        ts: new Date().toISOString(),
        source: 'Renderer',
        event: 'click',
        attributes: {},
      }),
    ).toThrow()
  })

  it('rejects non-scalar attribute values', () => {
    expect(() =>
      TelemetryEventSchema.parse({
        ts: new Date().toISOString(),
        source: 'renderer',
        event: 'click',
        attributes: { obj: { nested: 'no' } as unknown as string },
      }),
    ).toThrow()
  })
})

describe('redactTelemetryAttributes — PII drop', () => {
  it('drops email/phone/name keys (AC-7 redaction stage)', () => {
    const result = redactTelemetryAttributes({
      email: 'x@y.z',
      phone_number: '+1',
      full_name: 'Bob',
      surface: 'topbar',
    })
    expect(result.attributes.email).toBeUndefined()
    expect(result.attributes.phone_number).toBeUndefined()
    expect(result.attributes.full_name).toBeUndefined()
    expect(result.attributes.surface).toBe('topbar')
    expect(new Set(result.droppedKeys)).toEqual(new Set(['email', 'phone_number', 'full_name']))
  })

  it('also redacts token-like attributes via shared sanitizer', () => {
    const result = redactTelemetryAttributes({ token: 'secret' })
    expect(result.attributes.token).toBe('[REDACTED]')
  })

  it('drops nested objects (telemetry must be flat scalar)', () => {
    const result = redactTelemetryAttributes({ blob: { x: 1 } })
    expect(result.attributes.blob).toBeUndefined()
    expect(result.droppedKeys).toContain('blob')
  })
})

describe('emitTelemetryEvent — full fanout', () => {
  let captured: Array<unknown> = []
  let warnings: Array<{ message: string; meta?: Record<string, unknown> }> = []

  beforeEach(() => {
    captured = []
    warnings = []
    __resetTelemetryCountersForTests()
    setTelemetrySink(event => captured.push(event))
    setAuditLoggerWarn((message, meta) => warnings.push({ message, meta }))
  })

  afterEach(() => {
    setTelemetrySink(null)
    setAuditLoggerWarn(null)
    __resetTelemetryCountersForTests()
  })

  it('drops PII keys + emits warn (AC-7)', () => {
    const result = emitTelemetryEvent('renderer', 'click', { email: 'x@y.z', surface: 'topbar' })
    expect(result.droppedKeys).toEqual(['email'])
    expect(result.event.attributes.email).toBeUndefined()
    expect(result.event.attributes.surface).toBe('topbar')
    expect(warnings.some(w => w.message === 'telemetry.pii_dropped')).toBe(true)
    expect(captured).toHaveLength(1)
  })

  it('tracks dropped attribute counter', () => {
    emitTelemetryEvent('renderer', 'click', { email: 'a@b.c', phone: '+1', name: 'x', ok: true })
    expect(getDroppedTelemetryAttributesCount()).toBeGreaterThanOrEqual(3)
  })
})
