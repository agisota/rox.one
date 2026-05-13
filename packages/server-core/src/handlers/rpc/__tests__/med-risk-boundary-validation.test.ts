/**
 * T-T249-FOLLOWUP — boundary input validation tests for MED-risk handlers.
 *
 * Covers the 7 handler files hardened in this PR:
 *   automations, messaging, sessions, settings, sources, resources, oauth
 *
 * Each section verifies the new parsers added at the boundary:
 *   1. Rejects control characters (NUL, ESC, DEL)
 *   2. Rejects wrong type (number, null, undefined)
 *   3. Rejects empty/oversized strings
 *   4. Accepts valid inputs (no regression on currently-valid values)
 *
 * Control-byte test inputs are constructed via `String.fromCharCode` to
 * keep this file free of literal control bytes.
 */
import { describe, expect, it } from 'bun:test'
import {
  parseId,
  parseSafeString,
  parseOptionalSafeString,
  parseUrl,
  parseOptionalUrl,
  parseEnum,
  type InvalidInputError,
} from '../_validators'

const NUL = String.fromCharCode(0)
const ESC = String.fromCharCode(27)
const DEL = String.fromCharCode(127)

function expectInvalid(fn: () => unknown, messageFragment?: string): InvalidInputError {
  let caught: unknown
  try {
    fn()
  } catch (err) {
    caught = err
  }
  expect(caught).toBeInstanceOf(Error)
  expect((caught as InvalidInputError).code).toBe('INVALID_INPUT')
  if (messageFragment) {
    expect((caught as Error).message).toContain(messageFragment)
  }
  return caught as InvalidInputError
}

// ────────────────────────────────────────────────────────────────────────────
// parseSafeString — free-form string guard used by automations, sessions, etc.
// ────────────────────────────────────────────────────────────────────────────
describe('parseSafeString', () => {
  it('accepts a normal free-form string', () => {
    expect(parseSafeString('query', 'hello world', 256)).toBe('hello world')
  })

  it('accepts empty string (free-form fields may be blank)', () => {
    expect(parseSafeString('query', '', 256)).toBe('')
  })

  it('accepts whitespace-only string', () => {
    expect(parseSafeString('query', '   ', 256)).toBe('   ')
  })

  it('accepts string at exact max length', () => {
    const s = 'a'.repeat(256)
    expect(parseSafeString('query', s, 256)).toBe(s)
  })

  it('rejects non-string (number)', () => {
    expectInvalid(() => parseSafeString('query', 42, 256), 'must be a string')
  })

  it('rejects null', () => {
    expectInvalid(() => parseSafeString('query', null, 256), 'must be a string')
  })

  it('rejects string over max length', () => {
    const tooLong = 'a'.repeat(257)
    expectInvalid(() => parseSafeString('query', tooLong, 256), '<= 256 chars')
  })

  it('rejects string with NUL byte', () => {
    expectInvalid(() => parseSafeString('query', `search${NUL}term`, 256), 'control characters')
  })

  it('rejects string with ESC (terminal escape smuggling)', () => {
    expectInvalid(() => parseSafeString('query', `${ESC}[31mred`, 256), 'control characters')
  })

  it('rejects string with DEL (0x7F)', () => {
    expectInvalid(() => parseSafeString('token', `tok${DEL}en`, 256), 'control characters')
  })
})

// ────────────────────────────────────────────────────────────────────────────
// parseOptionalSafeString — used for optional platform, searchId, connection
// ────────────────────────────────────────────────────────────────────────────
describe('parseOptionalSafeString', () => {
  it('passes through undefined', () => {
    expect(parseOptionalSafeString('platform', undefined, 256)).toBeUndefined()
  })

  it('normalizes null to undefined', () => {
    expect(parseOptionalSafeString('platform', null, 256)).toBeUndefined()
  })

  it('accepts a valid string', () => {
    expect(parseOptionalSafeString('platform', 'telegram', 256)).toBe('telegram')
  })

  it('rejects oversized optional string', () => {
    const tooLong = 'a'.repeat(257)
    expectInvalid(() => parseOptionalSafeString('platform', tooLong, 256), '<= 256 chars')
  })

  it('rejects optional string with control char', () => {
    expectInvalid(() => parseOptionalSafeString('platform', `bad${NUL}value`, 256), 'control characters')
  })
})

// ────────────────────────────────────────────────────────────────────────────
// parseUrl — used by webhook URL guard (new in this PR)
// ────────────────────────────────────────────────────────────────────────────
describe('parseUrl', () => {
  it('accepts a valid https URL', () => {
    expect(parseUrl('callbackUrl', 'https://example.com/callback')).toBe('https://example.com/callback')
  })

  it('accepts a valid http URL', () => {
    expect(parseUrl('callbackUrl', 'http://localhost:3000/cb')).toBe('http://localhost:3000/cb')
  })

  it('rejects non-string', () => {
    expectInvalid(() => parseUrl('callbackUrl', 42), 'must be a string')
  })

  it('rejects empty string', () => {
    expectInvalid(() => parseUrl('callbackUrl', ''), 'must not be empty')
  })

  it('rejects string over 2048 chars', () => {
    const tooLong = 'https://example.com/' + 'a'.repeat(2030)
    expectInvalid(() => parseUrl('callbackUrl', tooLong), '<= 2048 chars')
  })

  it('rejects non-parseable string', () => {
    expectInvalid(() => parseUrl('callbackUrl', 'not a url'), 'must be a valid URL')
  })

  it('rejects javascript: scheme', () => {
    expectInvalid(() => parseUrl('callbackUrl', 'javascript:alert(1)'), 'must use http or https scheme')
  })

  it('rejects file: scheme', () => {
    expectInvalid(() => parseUrl('callbackUrl', 'file:///etc/passwd'), 'must use http or https scheme')
  })

  it('rejects URL with NUL byte', () => {
    expectInvalid(() => parseUrl('callbackUrl', `https://example.com/${NUL}`), 'control characters')
  })
})

// ────────────────────────────────────────────────────────────────────────────
// parseOptionalUrl
// ────────────────────────────────────────────────────────────────────────────
describe('parseOptionalUrl', () => {
  it('passes through undefined', () => {
    expect(parseOptionalUrl('callbackUrl', undefined)).toBeUndefined()
  })

  it('normalizes null to undefined', () => {
    expect(parseOptionalUrl('callbackUrl', null)).toBeUndefined()
  })

  it('accepts a valid URL', () => {
    expect(parseOptionalUrl('callbackUrl', 'https://example.com')).toBe('https://example.com')
  })

  it('rejects an invalid scheme when present', () => {
    expectInvalid(() => parseOptionalUrl('callbackUrl', 'ftp://bad.com'), 'must use http or https scheme')
  })
})

// ────────────────────────────────────────────────────────────────────────────
// automations — workspaceId + automationId + eventName guards
// ────────────────────────────────────────────────────────────────────────────
describe('automations boundary guards', () => {
  it('parseId accepts a valid workspaceId', () => {
    expect(parseId('workspaceId', 'ws-abc123')).toBe('ws-abc123')
  })

  it('parseId rejects numeric workspaceId', () => {
    expectInvalid(() => parseId('workspaceId', 42), 'must be a string')
  })

  it('parseId rejects workspaceId with NUL', () => {
    expectInvalid(() => parseId('workspaceId', `ws${NUL}bad`), 'control characters')
  })

  it('parseSafeString accepts valid eventName', () => {
    expect(parseSafeString('eventName', 'file:changed', 256)).toBe('file:changed')
  })

  it('parseSafeString rejects eventName with ESC (log injection)', () => {
    expectInvalid(() => parseSafeString('eventName', `${ESC}[1mevent`, 256), 'control characters')
  })

  it('parseId accepts valid automationId', () => {
    expect(parseId('automationId', 'auto-12345')).toBe('auto-12345')
  })

  it('parseId rejects empty automationId', () => {
    expectInvalid(() => parseId('automationId', ''), 'must not be empty')
  })
})

// ────────────────────────────────────────────────────────────────────────────
// messaging — platform, sessionId, bindingId, userId, token guards
// ────────────────────────────────────────────────────────────────────────────
describe('messaging boundary guards', () => {
  it('parseId accepts valid platform', () => {
    expect(parseId('platform', 'telegram')).toBe('telegram')
  })

  it('parseId rejects null platform', () => {
    expectInvalid(() => parseId('platform', null), 'must be a string')
  })

  it('parseId rejects platform with control char', () => {
    expectInvalid(() => parseId('platform', `tele${DEL}gram`), 'control characters')
  })

  it('parseId accepts valid sessionId', () => {
    expect(parseId('sessionId', 'sess-abc-123')).toBe('sess-abc-123')
  })

  it('parseId rejects empty sessionId', () => {
    expectInvalid(() => parseId('sessionId', ''), 'must not be empty')
  })

  it('parseSafeString accepts valid telegram token (opaque)', () => {
    expect(parseSafeString('token', '1234567890:ABCdef', 1024)).toBe('1234567890:ABCdef')
  })

  it('parseSafeString rejects token with NUL', () => {
    expectInvalid(() => parseSafeString('token', `tok${NUL}en`, 1024), 'control characters')
  })

  it('parseSafeString accepts valid phone number', () => {
    expect(parseSafeString('phoneNumber', '+1234567890', 32)).toBe('+1234567890')
  })

  it('parseSafeString rejects oversized phone number', () => {
    expectInvalid(() => parseSafeString('phoneNumber', '+1'.padEnd(33, '0'), 32), '<= 32 chars')
  })
})

// ────────────────────────────────────────────────────────────────────────────
// sessions — workspaceId, sessionId, query, shellId, taskId, requestId guards
// ────────────────────────────────────────────────────────────────────────────
describe('sessions boundary guards', () => {
  it('parseId accepts valid sessionId', () => {
    expect(parseId('sessionId', 'sess-xyzabc')).toBe('sess-xyzabc')
  })

  it('parseId rejects whitespace-only sessionId', () => {
    expectInvalid(() => parseId('sessionId', '   '), 'must not be whitespace-only')
  })

  it('parseSafeString accepts valid search query', () => {
    expect(parseSafeString('query', 'function foo', 1024)).toBe('function foo')
  })

  it('parseSafeString rejects query with NUL (log injection)', () => {
    expectInvalid(() => parseSafeString('query', `search${NUL}`, 1024), 'control characters')
  })

  it('parseSafeString accepts large message (up to 1M chars)', () => {
    const big = 'a'.repeat(1_000_000)
    expect(parseSafeString('message', big, 1_000_000)).toBe(big)
  })

  it('parseSafeString rejects message over 1M chars', () => {
    const tooBig = 'a'.repeat(1_000_001)
    expectInvalid(() => parseSafeString('message', tooBig, 1_000_000), '<= 1000000 chars')
  })

  it('parseId accepts valid shellId', () => {
    expect(parseId('shellId', 'shell-1')).toBe('shell-1')
  })

  it('parseId accepts valid requestId', () => {
    expect(parseId('requestId', 'req-9999')).toBe('req-9999')
  })

  it('parseOptionalSafeString accepts valid searchId', () => {
    expect(parseOptionalSafeString('searchId', 'srch-1', 128)).toBe('srch-1')
  })

  it('parseOptionalSafeString passes through undefined searchId', () => {
    expect(parseOptionalSafeString('searchId', undefined, 128)).toBeUndefined()
  })
})

// ────────────────────────────────────────────────────────────────────────────
// settings — sessionId, workspaceId, key, model, connection guards
// ────────────────────────────────────────────────────────────────────────────
describe('settings boundary guards', () => {
  it('parseId accepts valid key', () => {
    expect(parseId('key', 'model')).toBe('model')
  })

  it('parseId rejects key with control char', () => {
    expectInvalid(() => parseId('key', `model${ESC}`), 'control characters')
  })

  it('parseId accepts valid model string', () => {
    expect(parseId('model', 'claude-3-5-sonnet-20241022')).toBe('claude-3-5-sonnet-20241022')
  })

  it('parseOptionalSafeString accepts valid connection slug', () => {
    expect(parseOptionalSafeString('connection', 'my-connection', 256)).toBe('my-connection')
  })

  it('parseOptionalSafeString passes through undefined connection', () => {
    expect(parseOptionalSafeString('connection', undefined, 256)).toBeUndefined()
  })
})

// ────────────────────────────────────────────────────────────────────────────
// sources — workspaceId, sourceSlug guards (uses parseSlug for slug)
// ────────────────────────────────────────────────────────────────────────────
describe('sources boundary guards', () => {
  it('parseId accepts valid workspaceId', () => {
    expect(parseId('workspaceId', 'ws-prod-001')).toBe('ws-prod-001')
  })

  it('parseId rejects workspaceId over 256 chars', () => {
    expectInvalid(() => parseId('workspaceId', 'ws-'.padEnd(257, 'x')), '<= 256 chars')
  })
})

// ────────────────────────────────────────────────────────────────────────────
// resources — mode enum guard
// ────────────────────────────────────────────────────────────────────────────
describe('resources boundary guards', () => {
  it('parseEnum accepts "skip" mode', () => {
    expect(parseEnum('mode', 'skip', ['skip', 'overwrite'] as const)).toBe('skip')
  })

  it('parseEnum accepts "overwrite" mode', () => {
    expect(parseEnum('mode', 'overwrite', ['skip', 'overwrite'] as const)).toBe('overwrite')
  })

  it('parseEnum rejects unknown mode', () => {
    expectInvalid(() => parseEnum('mode', 'merge', ['skip', 'overwrite'] as const), 'must be one of')
  })

  it('parseEnum rejects non-string mode', () => {
    expectInvalid(() => parseEnum('mode', null, ['skip', 'overwrite'] as const), 'must be a string')
  })
})

// ────────────────────────────────────────────────────────────────────────────
// oauth — sourceSlug, flowId, code, state guards
// ────────────────────────────────────────────────────────────────────────────
describe('oauth boundary guards', () => {
  it('parseId accepts valid sourceSlug', () => {
    expect(parseId('sourceSlug', 'github-mcp')).toBe('github-mcp')
  })

  it('parseId rejects sourceSlug with NUL', () => {
    expectInvalid(() => parseId('sourceSlug', `github${NUL}mcp`), 'control characters')
  })

  it('parseId accepts valid flowId (UUID-like)', () => {
    expect(parseId('flowId', '550e8400-e29b-41d4-a716-446655440000')).toBe('550e8400-e29b-41d4-a716-446655440000')
  })

  it('parseId rejects empty flowId', () => {
    expectInvalid(() => parseId('flowId', ''), 'must not be empty')
  })

  it('parseSafeString accepts valid OAuth code', () => {
    expect(parseSafeString('code', 'abc123def456', 2048)).toBe('abc123def456')
  })

  it('parseSafeString rejects code with control char', () => {
    expectInvalid(() => parseSafeString('code', `code${ESC}injection`, 2048), 'control characters')
  })

  it('parseSafeString accepts valid state token', () => {
    expect(parseSafeString('state', 'random-state-value-abc', 2048)).toBe('random-state-value-abc')
  })

  it('parseSafeString rejects oversized state token', () => {
    const tooLong = 'a'.repeat(2049)
    expectInvalid(() => parseSafeString('state', tooLong, 2048), '<= 2048 chars')
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Cross-handler: every new rejection path carries code = INVALID_INPUT
// ────────────────────────────────────────────────────────────────────────────
describe('error code stability across new parsers', () => {
  it('all new reject paths tag code = INVALID_INPUT', () => {
    const rejectFns: Array<() => unknown> = [
      () => parseSafeString('x', null, 256),
      () => parseSafeString('x', 'a'.repeat(10), 5),
      () => parseSafeString('x', `bad${NUL}`, 256),
      () => parseOptionalSafeString('x', `bad${ESC}`, 256),
      () => parseUrl('x', 'not-a-url'),
      () => parseUrl('x', 'ftp://bad'),
      () => parseUrl('x', `https://example.com/${NUL}`),
      () => parseOptionalUrl('x', 'file:///etc'),
      () => parseEnum('x', 'nope', ['a', 'b'] as const),
    ]
    for (const fn of rejectFns) {
      let err: unknown
      try {
        fn()
      } catch (e) {
        err = e
      }
      expect(err).toBeInstanceOf(Error)
      expect((err as InvalidInputError).code).toBe('INVALID_INPUT')
    }
  })
})
