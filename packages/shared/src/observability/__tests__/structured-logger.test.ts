import { describe, expect, it } from 'bun:test'

import { asCorrelationId, withCorrelationId } from '../correlation.ts'
import { type LogRecord, type LogSink, createStructuredLogger } from '../structured-logger.ts'

function memorySink(): { records: LogRecord[]; sink: LogSink } {
  const records: LogRecord[] = []
  return {
    records,
    sink: record => {
      records.push(record)
    },
  }
}

const FIXED_NOW = new Date('2026-05-13T12:00:00.000Z')
const fixedClock = (): Date => FIXED_NOW

describe('createStructuredLogger', () => {
  it('emits info-level records with timestamp, level, message, fields', () => {
    const { records, sink } = memorySink()
    const logger = createStructuredLogger({ sink, threshold: 'trace', clock: fixedClock })

    logger.info('hello', { userId: 'u-1' })

    expect(records).toHaveLength(1)
    const [record] = records
    expect(record).toBeDefined()
    expect(record?.level).toBe('info')
    expect(record?.message).toBe('hello')
    expect(record?.fields).toEqual({ userId: 'u-1' })
    expect(record?.ts).toBe(FIXED_NOW.toISOString())
  })

  it('exposes a method per log level', () => {
    const { records, sink } = memorySink()
    const logger = createStructuredLogger({ sink, threshold: 'trace', clock: fixedClock })

    logger.trace('t')
    logger.debug('d')
    logger.info('i')
    logger.warn('w')
    logger.error('e')
    logger.fatal('f')

    const levels = records.map(r => r.level)
    expect(levels).toEqual(['trace', 'debug', 'info', 'warn', 'error', 'fatal'])
  })

  it('drops records below the configured threshold', () => {
    const { records, sink } = memorySink()
    const logger = createStructuredLogger({ sink, threshold: 'warn', clock: fixedClock })

    logger.trace('t')
    logger.debug('d')
    logger.info('i')
    logger.warn('w')
    logger.error('e')
    logger.fatal('f')

    const levels = records.map(r => r.level)
    expect(levels).toEqual(['warn', 'error', 'fatal'])
  })

  it('stamps the current correlation id when one is active', () => {
    const { records, sink } = memorySink()
    const logger = createStructuredLogger({ sink, threshold: 'trace', clock: fixedClock })

    withCorrelationId(asCorrelationId('span-X'), () => {
      logger.info('inside-span')
    })
    logger.info('outside-span')

    expect(records[0]?.correlationId).toBe(asCorrelationId('span-X'))
    expect(records[1]?.correlationId).toBeUndefined()
  })

  it('serialises Error instances into structured fields', () => {
    const { records, sink } = memorySink()
    const logger = createStructuredLogger({ sink, threshold: 'trace', clock: fixedClock })

    const err = new Error('failure')
    logger.error('op failed', { err })

    const field = records[0]?.fields?.err
    expect(field).toBeDefined()
    expect(field).toMatchObject({ name: 'Error', message: 'failure' })
    expect(typeof (field as { stack?: unknown }).stack === 'string').toBe(true)
  })

  it('child() returns a logger that merges bound fields onto every record', () => {
    const { records, sink } = memorySink()
    const root = createStructuredLogger({ sink, threshold: 'trace', clock: fixedClock })

    const child = root.child({ tenantId: 't-1' })
    child.info('msg', { extra: 1 })

    expect(records[0]?.fields).toEqual({ tenantId: 't-1', extra: 1 })
  })

  it('child() fields are overridable by per-call fields', () => {
    const { records, sink } = memorySink()
    const root = createStructuredLogger({ sink, threshold: 'trace', clock: fixedClock })

    const child = root.child({ tenantId: 't-bound' })
    child.warn('overrides', { tenantId: 't-override' })

    expect(records[0]?.fields?.tenantId).toBe('t-override')
  })

  it('child() inherits the parent threshold (and respects new threshold override)', () => {
    const { records, sink } = memorySink()
    const root = createStructuredLogger({ sink, threshold: 'warn', clock: fixedClock })

    const inheriting = root.child({})
    inheriting.info('should-drop')
    expect(records).toHaveLength(0)

    const louder = root.child({}, { threshold: 'debug' })
    louder.debug('should-emit')
    expect(records).toHaveLength(1)
    expect(records[0]?.level).toBe('debug')
  })

  it('sink throw does not bubble up to the caller (logging is best-effort)', () => {
    const logger = createStructuredLogger({
      sink: () => {
        throw new Error('sink down')
      },
      threshold: 'trace',
      clock: fixedClock,
    })

    expect(() => logger.info('safe')).not.toThrow()
  })

  it('rejects unknown thresholds at construction', () => {
    const { sink } = memorySink()
    expect(() =>
      createStructuredLogger({
        sink,
        threshold: 'verbose' as never,
        clock: fixedClock,
      }),
    ).toThrow(/log level/i)
  })

  it('records carry a stable shape (level, ts, message, fields, correlationId optional)', () => {
    const { records, sink } = memorySink()
    const logger = createStructuredLogger({ sink, threshold: 'trace', clock: fixedClock })
    logger.info('shape-check')
    const r = records[0]
    expect(r).toBeDefined()
    if (!r) throw new Error('unreachable')
    expect(Object.keys(r).sort()).toEqual(['fields', 'level', 'message', 'ts'])
  })
})
