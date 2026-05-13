/**
 * bun:test coverage for the line-numbers pure helpers (M.10 T236).
 *
 * The helper backs the composer's expanded-mode gutter. We exercise:
 * - empty string → still one line (caret-on-row-1 invariant)
 * - single line of text → one line
 * - one newline → two lines
 * - trailing newline counted (matches textarea cursor row after Enter)
 * - leading newline counted
 * - multiple consecutive newlines → empty rows counted
 * - CRLF newlines counted the same as LF
 * - lone CR not counted (modern textareas normalise to LF)
 * - non-string inputs guarded (defensive fall back to 1)
 * - `buildLineNumbers` returns `[1, …, N]` with the right length
 */
import { describe, it, expect } from 'bun:test'

import { buildLineNumbers, countLines } from '../line-numbers'

describe('countLines', () => {
  it('returns 1 for an empty string', () => {
    expect(countLines('')).toBe(1)
  })

  it('returns 1 for a single line of text', () => {
    expect(countLines('hello world')).toBe(1)
  })

  it('returns 2 when value contains a single newline', () => {
    expect(countLines('hello\nworld')).toBe(2)
  })

  it('counts a trailing newline as an additional row', () => {
    // After pressing Enter at the end of "hello", the caret sits on row 2.
    expect(countLines('hello\n')).toBe(2)
  })

  it('counts a leading newline as an additional row', () => {
    expect(countLines('\nhello')).toBe(2)
  })

  it('counts every newline in a multi-line value', () => {
    expect(countLines('a\nb\nc\nd')).toBe(4)
  })

  it('counts consecutive newlines as separate (empty) rows', () => {
    expect(countLines('a\n\n\nb')).toBe(4)
  })

  it('treats CRLF the same as LF (only the LF counts)', () => {
    // Windows line endings: \r\n. Each \n increments the count.
    expect(countLines('a\r\nb\r\nc')).toBe(3)
  })

  it('does not count a lone carriage return', () => {
    // Old-Mac \r line endings: textareas normalise to \n, so the helper
    // mirrors that and ignores stray CRs.
    expect(countLines('a\rb\rc')).toBe(1)
  })

  it('falls back to 1 when given a non-string value', () => {
    // Defensive guard: callers should always pass a string, but the
    // gutter's render path stays correct if a stray `undefined` slips in.
    expect(countLines(undefined as unknown as string)).toBe(1)
    expect(countLines(null as unknown as string)).toBe(1)
    expect(countLines(0 as unknown as string)).toBe(1)
  })
})

describe('buildLineNumbers', () => {
  it('returns [1] for an empty value', () => {
    expect(buildLineNumbers('')).toEqual([1])
  })

  it('returns a 1..N sequence whose length matches countLines', () => {
    const value = 'a\nb\nc\nd\ne'
    const rows = buildLineNumbers(value)
    expect(rows.length).toBe(countLines(value))
    expect(rows).toEqual([1, 2, 3, 4, 5])
  })

  it('produces the right rows for a trailing newline', () => {
    expect(buildLineNumbers('foo\n')).toEqual([1, 2])
  })
})
