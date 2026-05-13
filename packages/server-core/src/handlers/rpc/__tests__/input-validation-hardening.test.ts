/**
 * M.13 T038 — boundary input validation tests for labels/statuses/skills.
 *
 * For each handler hardened, we verify the boundary parser:
 *   1. rejects empty payload
 *   2. rejects wrong type (number, null, etc.)
 *   3. rejects missing required field / wrong discriminator
 *   4. accepts a valid payload
 *
 * The parsers throw `Error & { code: 'INVALID_INPUT' }`; tests assert
 * BOTH the thrown error AND the `code` field so any future refactor
 * that changes the error contract surfaces immediately.
 *
 * Control-byte test inputs are constructed via `String.fromCharCode` to
 * keep this file free of literal control bytes (otherwise git treats
 * the file as binary and diffs become opaque).
 */
import { describe, expect, it } from 'bun:test'
import {
  invalidInput,
  parseId,
  parseSlug,
  parseOptionalString,
  parseStringArray,
  parseEnum,
  parseCreateLabelInput,
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

describe('M.13 T038 — boundary input validators', () => {
  describe('invalidInput()', () => {
    it('throws Error & { code: INVALID_INPUT }', () => {
      expectInvalid(() => invalidInput('synthesized error'), 'synthesized error')
    })
  })

  describe('parseId', () => {
    it('accepts a normal id', () => {
      expect(parseId('workspaceId', 'ws-abc-123')).toBe('ws-abc-123')
    })

    it('rejects a non-string (number)', () => {
      expectInvalid(() => parseId('workspaceId', 42), 'must be a string')
    })

    it('rejects null', () => {
      expectInvalid(() => parseId('workspaceId', null), 'must be a string')
    })

    it('rejects undefined', () => {
      expectInvalid(() => parseId('workspaceId', undefined), 'must be a string')
    })

    it('rejects empty string', () => {
      expectInvalid(() => parseId('workspaceId', ''), 'must not be empty')
    })

    it('rejects whitespace-only string', () => {
      expectInvalid(() => parseId('workspaceId', '   '), 'must not be whitespace-only')
    })

    it('rejects strings over 256 chars', () => {
      const tooLong = 'a'.repeat(257)
      expectInvalid(() => parseId('workspaceId', tooLong), '<= 256 chars')
    })

    it('rejects strings with NUL byte', () => {
      const withNul = `ws-id${NUL}-malicious`
      expectInvalid(() => parseId('workspaceId', withNul), 'control characters')
    })

    it('rejects strings with ANSI escape (terminal smuggling)', () => {
      const withEscape = `ws${ESC}[31mid`
      expectInvalid(() => parseId('workspaceId', withEscape), 'control characters')
    })

    it('rejects strings with DEL (0x7F)', () => {
      const withDel = `ws${DEL}id`
      expectInvalid(() => parseId('workspaceId', withDel), 'control characters')
    })
  })

  describe('parseSlug — path traversal guards', () => {
    it('accepts a clean slug', () => {
      expect(parseSlug('skillSlug', 'my-skill')).toBe('my-skill')
    })

    it('rejects parent-directory traversal', () => {
      expectInvalid(() => parseSlug('skillSlug', '../etc/passwd'), "must not contain '..'")
    })

    it('rejects an absolute POSIX path', () => {
      expectInvalid(() => parseSlug('skillSlug', '/etc/passwd'), 'must not be absolute')
    })

    it('rejects an absolute Windows path', () => {
      expectInvalid(() => parseSlug('skillSlug', '\\windows\\system32'), 'must not be absolute')
    })

    it('rejects embedded backslashes', () => {
      expectInvalid(() => parseSlug('skillSlug', 'my\\skill'), 'must not contain backslashes')
    })

    it('rejects the wildcard meta token', () => {
      expectInvalid(() => parseSlug('skillSlug', '*'), 'must not be a meta token')
    })

    it('rejects a single-dot segment', () => {
      expectInvalid(() => parseSlug('skillSlug', '.'), 'must not be a meta token')
    })

    it('rejects double-dot inside the middle of a string too', () => {
      expectInvalid(() => parseSlug('skillSlug', 'foo..bar'), "must not contain '..'")
    })
  })

  describe('parseOptionalString', () => {
    it('passes through undefined', () => {
      expect(parseOptionalString('workingDirectory', undefined)).toBeUndefined()
    })

    it('normalizes null to undefined', () => {
      expect(parseOptionalString('workingDirectory', null)).toBeUndefined()
    })

    it('accepts a valid string', () => {
      expect(parseOptionalString('workingDirectory', '/home/dev/proj')).toBe('/home/dev/proj')
    })

    it('rejects empty string (not the same as missing)', () => {
      expectInvalid(() => parseOptionalString('workingDirectory', ''))
    })
  })

  describe('parseStringArray', () => {
    it('accepts a valid string array', () => {
      const out = parseStringArray('orderedIds', ['a', 'b', 'c'])
      expect(out).toEqual(['a', 'b', 'c'])
    })

    it('accepts an empty array', () => {
      expect(parseStringArray('orderedIds', [])).toEqual([])
    })

    it('rejects a non-array (string)', () => {
      expectInvalid(() => parseStringArray('orderedIds', 'not an array'), 'must be an array')
    })

    it('rejects a non-array (object)', () => {
      expectInvalid(() => parseStringArray('orderedIds', { 0: 'a', length: 1 }), 'must be an array')
    })

    it('rejects an array with non-string elements', () => {
      expectInvalid(() => parseStringArray('orderedIds', ['a', 42, 'c']), 'orderedIds[1] must be a string')
    })

    it('rejects when over the max length', () => {
      const big = Array.from({ length: 11 }, (_, i) => `id-${i}`)
      expectInvalid(() => parseStringArray('orderedIds', big, { maxLen: 10 }), '<= 10 entries')
    })

    it('rejects per-item failures (control char inside element)', () => {
      const bad = `bad${NUL}id`
      expectInvalid(() => parseStringArray('orderedIds', ['ok', bad]), 'control characters')
    })
  })

  describe('parseEnum — discriminator enforcement', () => {
    const allowed = ['safe', 'ask', 'allow-all'] as const

    it('accepts a value in the allow-list', () => {
      expect(parseEnum('mode', 'safe', allowed)).toBe('safe')
    })

    it('rejects an unknown discriminator value', () => {
      expectInvalid(() => parseEnum('mode', 'godmode', allowed), 'must be one of')
    })

    it('rejects a non-string discriminator', () => {
      expectInvalid(() => parseEnum('mode', 1 as unknown, allowed), 'must be a string')
    })
  })

  describe('parseCreateLabelInput — labels.CREATE boundary schema', () => {
    it('accepts minimal valid payload (name only)', () => {
      const out = parseCreateLabelInput({ name: 'TODO' })
      expect(out).toEqual({ name: 'TODO' })
    })

    it('accepts a payload with a system-color string', () => {
      const out = parseCreateLabelInput({ name: 'High Priority', color: 'accent/80' })
      expect(out).toEqual({ name: 'High Priority', color: 'accent/80' })
    })

    it('accepts a payload with a custom-color object (light only)', () => {
      const out = parseCreateLabelInput({ name: 'Custom', color: { light: '#EF4444' } })
      expect(out).toEqual({ name: 'Custom', color: { light: '#EF4444' } })
    })

    it('accepts a payload with a custom-color object (light + dark)', () => {
      const out = parseCreateLabelInput({ name: 'Custom', color: { light: '#EF4444', dark: '#F87171' } })
      expect(out).toEqual({ name: 'Custom', color: { light: '#EF4444', dark: '#F87171' } })
    })

    it('accepts a payload with explicit null parentId', () => {
      const out = parseCreateLabelInput({ name: 'Child', parentId: null })
      expect(out).toEqual({ name: 'Child', color: undefined, parentId: null })
    })

    it('accepts a payload with string parentId', () => {
      const out = parseCreateLabelInput({ name: 'Child', parentId: 'lbl-root' })
      expect(out).toEqual({ name: 'Child', color: undefined, parentId: 'lbl-root' })
    })

    it('rejects an empty payload (missing required name)', () => {
      expectInvalid(() => parseCreateLabelInput({}), 'CreateLabelInput.name must be a string')
    })

    it('rejects a non-object payload', () => {
      expectInvalid(() => parseCreateLabelInput('not an object'), 'CreateLabelInput must be an object')
    })

    it('rejects a null payload', () => {
      expectInvalid(() => parseCreateLabelInput(null), 'CreateLabelInput must be an object')
    })

    it('rejects name as a number (wrong field type)', () => {
      expectInvalid(() => parseCreateLabelInput({ name: 123 }), 'CreateLabelInput.name must be a string')
    })

    it('rejects name as empty string', () => {
      expectInvalid(() => parseCreateLabelInput({ name: '' }), 'must not be empty')
    })

    it('rejects color as number (wrong color discriminator)', () => {
      expectInvalid(() => parseCreateLabelInput({ name: 'X', color: 42 }), 'must be a string or an object')
    })

    it('rejects color object missing required light field', () => {
      expectInvalid(
        () => parseCreateLabelInput({ name: 'X', color: { dark: '#000' } }),
        'CreateLabelInput.color.light must be a string',
      )
    })

    it('rejects color string with control characters (log injection)', () => {
      const malicious = `${ESC}[31m#FF0000${ESC}[0m`
      expectInvalid(() => parseCreateLabelInput({ name: 'X', color: malicious }), 'control characters')
    })

    it('rejects parentId as a number', () => {
      expectInvalid(
        () => parseCreateLabelInput({ name: 'X', parentId: 0 }),
        'CreateLabelInput.parentId must be a string',
      )
    })

    it('rejects name with NUL byte', () => {
      const badName = `OK${NUL}bad`
      expectInvalid(() => parseCreateLabelInput({ name: badName }), 'control characters')
    })
  })

  describe('cross-handler smoke — error code stability', () => {
    it('every reject path tags code = INVALID_INPUT (single property)', () => {
      const rejectFns: Array<() => unknown> = [
        () => parseId('x', 1),
        () => parseId('x', ''),
        () => parseSlug('x', '..'),
        () => parseSlug('x', '*'),
        () => parseStringArray('x', null),
        () => parseStringArray('x', [1]),
        () => parseEnum('x', 'nope', ['a', 'b'] as const),
        () => parseCreateLabelInput(null),
        () => parseCreateLabelInput({ name: 1 }),
        () => parseCreateLabelInput({ name: 'X', color: 1 }),
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
})
