import { describe, expect, it } from 'bun:test'

import {
  LOG_LEVELS,
  compareLogLevels,
  isLogLevel,
  logLevelRank,
  shouldLog,
} from '../log-level.ts'
import { type LogLevel } from '../log-level.ts'

describe('LogLevel enum', () => {
  it('lists levels from trace to fatal in increasing severity', () => {
    expect(LOG_LEVELS).toEqual(['trace', 'debug', 'info', 'warn', 'error', 'fatal'])
  })

  it('exposes typed string literal constants', () => {
    const trace: LogLevel = 'trace'
    const fatal: LogLevel = 'fatal'
    expect(trace).toBe('trace')
    expect(fatal).toBe('fatal')
  })
})

describe('logLevelRank', () => {
  it('assigns strictly increasing ranks', () => {
    expect(logLevelRank('trace')).toBe(0)
    expect(logLevelRank('debug')).toBe(1)
    expect(logLevelRank('info')).toBe(2)
    expect(logLevelRank('warn')).toBe(3)
    expect(logLevelRank('error')).toBe(4)
    expect(logLevelRank('fatal')).toBe(5)
  })
})

describe('compareLogLevels', () => {
  it('returns negative when left is less severe', () => {
    expect(compareLogLevels('trace', 'fatal')).toBeLessThan(0)
    expect(compareLogLevels('info', 'warn')).toBeLessThan(0)
  })

  it('returns positive when left is more severe', () => {
    expect(compareLogLevels('fatal', 'trace')).toBeGreaterThan(0)
    expect(compareLogLevels('error', 'warn')).toBeGreaterThan(0)
  })

  it('returns zero when both levels match', () => {
    expect(compareLogLevels('info', 'info')).toBe(0)
  })
})

describe('shouldLog predicate', () => {
  it('allows event when severity meets or exceeds the threshold', () => {
    expect(shouldLog('info', 'info')).toBe(true)
    expect(shouldLog('info', 'warn')).toBe(true)
    expect(shouldLog('info', 'fatal')).toBe(true)
  })

  it('rejects events below threshold', () => {
    expect(shouldLog('warn', 'info')).toBe(false)
    expect(shouldLog('warn', 'debug')).toBe(false)
    expect(shouldLog('error', 'warn')).toBe(false)
  })

  it('treats fatal as the most permissive threshold producer', () => {
    expect(shouldLog('fatal', 'trace')).toBe(false)
    expect(shouldLog('fatal', 'fatal')).toBe(true)
  })

  it('treats trace as the least permissive threshold (all pass)', () => {
    for (const level of LOG_LEVELS) {
      expect(shouldLog('trace', level)).toBe(true)
    }
  })
})

describe('isLogLevel guard', () => {
  it('accepts every known level', () => {
    for (const level of LOG_LEVELS) {
      expect(isLogLevel(level)).toBe(true)
    }
  })

  it('rejects unknown strings and non-strings', () => {
    expect(isLogLevel('verbose')).toBe(false)
    expect(isLogLevel('')).toBe(false)
    expect(isLogLevel(undefined)).toBe(false)
    expect(isLogLevel(null)).toBe(false)
    expect(isLogLevel(42)).toBe(false)
    expect(isLogLevel({})).toBe(false)
  })
})
