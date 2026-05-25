import { describe, expect, it } from 'bun:test'

import {
  REDACTED_PLACEHOLDER,
  sanitizePayload,
} from '../../../packages/shared/src/audit/index.ts'

describe('sanitizePayload — key-based redaction (AC-4)', () => {
  it('redacts top-level password + api_key', () => {
    const out = sanitizePayload({ password: 'x', api_key: 'y' })
    expect(out.password).toBe(REDACTED_PLACEHOLDER)
    expect(out.api_key).toBe(REDACTED_PLACEHOLDER)
  })

  it('redacts token / secret / cookie / authorization / bearer', () => {
    const out = sanitizePayload({
      token: 't',
      secret: 's',
      cookie: 'c',
      authorization: 'Bearer xxx',
      bearer: 'b',
    })
    for (const key of ['token', 'secret', 'cookie', 'authorization', 'bearer']) {
      expect((out as Record<string, unknown>)[key]).toBe(REDACTED_PLACEHOLDER)
    }
  })

  it('redacts refresh_token / access_token / refresh-token (hyphen + underscore)', () => {
    const out = sanitizePayload({
      refresh_token: 'r',
      access_token: 'a',
      'refresh-token': 'r2',
      'access-token': 'a2',
    })
    expect((out as Record<string, unknown>).refresh_token).toBe(REDACTED_PLACEHOLDER)
    expect((out as Record<string, unknown>).access_token).toBe(REDACTED_PLACEHOLDER)
    expect((out as Record<string, unknown>)['refresh-token']).toBe(REDACTED_PLACEHOLDER)
    expect((out as Record<string, unknown>)['access-token']).toBe(REDACTED_PLACEHOLDER)
  })

  it('is case-insensitive on keys', () => {
    const out = sanitizePayload({ Password: 'p', AUTHORIZATION: 'a', ApiKey: 'k' })
    expect(out.Password).toBe(REDACTED_PLACEHOLDER)
    expect(out.AUTHORIZATION).toBe(REDACTED_PLACEHOLDER)
    expect(out.ApiKey).toBe(REDACTED_PLACEHOLDER)
  })
})

describe('sanitizePayload — nested + arrays (AC-5)', () => {
  it('redacts nested authorization key', () => {
    const out = sanitizePayload({ data: { authorization: 'Bearer xxx' } }) as {
      data: { authorization: string }
    }
    expect(out.data.authorization).toBe(REDACTED_PLACEHOLDER)
  })

  it('walks arrays of objects', () => {
    const out = sanitizePayload({ items: [{ password: 'a' }, { password: 'b' }] }) as {
      items: Array<{ password: string }>
    }
    expect(out.items[0]!.password).toBe(REDACTED_PLACEHOLDER)
    expect(out.items[1]!.password).toBe(REDACTED_PLACEHOLDER)
  })

  it('preserves non-sensitive keys', () => {
    const out = sanitizePayload({ visible: 'ok', nested: { also: 'fine' } }) as {
      visible: string
      nested: { also: string }
    }
    expect(out.visible).toBe('ok')
    expect(out.nested.also).toBe('fine')
  })
})

describe('sanitizePayload — value-pattern redaction', () => {
  it('redacts JWT-like values', () => {
    const out = sanitizePayload({ candidate: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.SflKxwRJSMeKKF2QT' }) as {
      candidate: string
    }
    expect(out.candidate).toBe(REDACTED_PLACEHOLDER)
  })

  it('redacts hex32+ values', () => {
    const out = sanitizePayload({ blob: 'a'.repeat(32) }) as { blob: string }
    expect(out.blob).toBe(REDACTED_PLACEHOLDER)
  })

  it('redacts base64-40+ values', () => {
    const out = sanitizePayload({ blob: 'A'.repeat(40) }) as { blob: string }
    expect(out.blob).toBe(REDACTED_PLACEHOLDER)
  })

  it('does not redact short hex', () => {
    const out = sanitizePayload({ short: 'abc123' }) as { short: string }
    expect(out.short).toBe('abc123')
  })
})

describe('sanitizePayload — circular refs (AC-6)', () => {
  it('does not infinite-loop on cyclic structures', () => {
    const a: Record<string, unknown> = { name: 'a' }
    a.self = a
    const out = sanitizePayload(a) as Record<string, unknown>
    expect(out.name).toBe('a')
    expect(out.self).toBe('[CIRCULAR]')
  })

  it('handles mutual recursion', () => {
    const a: Record<string, unknown> = { tag: 'a' }
    const b: Record<string, unknown> = { tag: 'b' }
    a.peer = b
    b.peer = a
    const out = sanitizePayload(a) as Record<string, unknown>
    expect(out.tag).toBe('a')
    expect(((out.peer as Record<string, unknown>).peer)).toBe('[CIRCULAR]')
  })
})

describe('sanitizePayload — immutability', () => {
  it('does not mutate input', () => {
    const input = { password: 'real', visible: 'ok' }
    const snapshot = { ...input }
    sanitizePayload(input)
    expect(input).toEqual(snapshot)
  })
})

describe('sanitizePayload — extra patterns', () => {
  it('accepts extra key patterns', () => {
    const out = sanitizePayload({ customSecret: 'x' }, {
      extraKeyPatterns: [/^customSecret$/i],
    }) as { customSecret: string }
    expect(out.customSecret).toBe(REDACTED_PLACEHOLDER)
  })
})
