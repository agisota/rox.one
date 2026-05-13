/**
 * emphasis-mode.test.ts (M.10 T235)
 *
 * Exhaustive coverage for the pure emphasis helper that backs the composer
 * formatting toolbar. The helper is intentionally framework-free, so these
 * tests do not need React, JSDOM, or RTL — they exercise word, line, empty,
 * and nested selections directly.
 */

import { describe, expect, it } from 'bun:test'

import {
  EMPHASIS_MARKERS,
  EMPHASIS_SHORTCUTS,
  matchEmphasisShortcut,
  toggleEmphasis,
  type EmphasisMode,
} from '../emphasis-mode'

const sel = (start: number, end: number) => ({ start, end })

describe('emphasis-mode markers', () => {
  it('exposes the canonical marker for each mode', () => {
    expect(EMPHASIS_MARKERS.bold).toBe('**')
    expect(EMPHASIS_MARKERS.italic).toBe('_')
    expect(EMPHASIS_MARKERS.code).toBe('`')
    expect(EMPHASIS_MARKERS.strike).toBe('~~')
  })

  it('freezes the markers table so callers can not mutate it', () => {
    expect(Object.isFrozen(EMPHASIS_MARKERS)).toBe(true)
  })
})

describe('toggleEmphasis - word selection', () => {
  it('wraps a fully selected word in bold markers', () => {
    const { next, nextSelection } = toggleEmphasis('hello', sel(0, 5), 'bold')
    expect(next).toBe('**hello**')
    expect(nextSelection).toEqual(sel(2, 7))
  })

  it('wraps a fully selected word in italic markers', () => {
    const { next, nextSelection } = toggleEmphasis('hello', sel(0, 5), 'italic')
    expect(next).toBe('_hello_')
    expect(nextSelection).toEqual(sel(1, 6))
  })

  it('wraps a fully selected word in inline code markers', () => {
    const { next, nextSelection } = toggleEmphasis('print(x)', sel(0, 8), 'code')
    expect(next).toBe('`print(x)`')
    expect(nextSelection).toEqual(sel(1, 9))
  })

  it('wraps a fully selected word in strike markers', () => {
    const { next, nextSelection } = toggleEmphasis('hello', sel(0, 5), 'strike')
    expect(next).toBe('~~hello~~')
    expect(nextSelection).toEqual(sel(2, 7))
  })

  it('preserves leading and trailing context outside the wrap', () => {
    const value = 'pre hello post'
    const { next, nextSelection } = toggleEmphasis(value, sel(4, 9), 'bold')
    expect(next).toBe('pre **hello** post')
    expect(nextSelection).toEqual(sel(6, 11))
  })
})

describe('toggleEmphasis - line / multi-word selection', () => {
  it('wraps a multi-word line in italic markers', () => {
    const value = 'the quick brown fox'
    const { next, nextSelection } = toggleEmphasis(value, sel(0, value.length), 'italic')
    expect(next).toBe('_the quick brown fox_')
    expect(nextSelection).toEqual(sel(1, 1 + value.length))
  })

  it('wraps a line that contains punctuation without stripping it', () => {
    const value = 'hello, world!'
    const { next } = toggleEmphasis(value, sel(0, value.length), 'bold')
    expect(next).toBe('**hello, world!**')
  })

  it('wraps a subset of a line, leaving the rest untouched', () => {
    const value = 'alpha beta gamma'
    const { next, nextSelection } = toggleEmphasis(value, sel(6, 10), 'code')
    expect(next).toBe('alpha `beta` gamma')
    expect(nextSelection).toEqual(sel(7, 11))
  })
})

describe('toggleEmphasis - empty selection', () => {
  it('inserts an empty marker pair into an empty string', () => {
    const { next, nextSelection } = toggleEmphasis('', sel(0, 0), 'bold')
    expect(next).toBe('****')
    expect(nextSelection).toEqual(sel(2, 2))
  })

  it('places the caret between markers when inserted into whitespace', () => {
    // Cursor sits between two spaces — both neighbours are non-word, so the
    // helper inserts an empty marker pair without expanding outward.
    const { next, nextSelection } = toggleEmphasis('hello  world', sel(6, 6), 'italic')
    expect(next).toBe('hello __ world')
    // Caret should sit *between* the two markers.
    expect(nextSelection).toEqual(sel(7, 7))
  })

  it('expands an empty selection to the surrounding word (cursor mid-word)', () => {
    const { next, nextSelection } = toggleEmphasis('hello world', sel(2, 2), 'bold')
    expect(next).toBe('**hello** world')
    expect(nextSelection).toEqual(sel(2, 7))
  })

  it('expands an empty selection that sits at the start of a word', () => {
    const { next } = toggleEmphasis('hello world', sel(0, 0), 'italic')
    expect(next).toBe('_hello_ world')
  })

  it('expands an empty selection that sits at the end of a word', () => {
    const { next } = toggleEmphasis('hello world', sel(5, 5), 'italic')
    expect(next).toBe('_hello_ world')
  })
})

describe('toggleEmphasis - nested / repeated toggling', () => {
  it('strips bold markers when toggling bold on an already bold selection', () => {
    const value = '**hello**'
    const { next, nextSelection } = toggleEmphasis(value, sel(0, value.length), 'bold')
    expect(next).toBe('hello')
    expect(nextSelection).toEqual(sel(0, 5))
  })

  it('strips italic markers when the selection is the inner text', () => {
    const value = '_hello_'
    // selection covers the inner "hello".
    const { next, nextSelection } = toggleEmphasis(value, sel(1, 6), 'italic')
    expect(next).toBe('hello')
    expect(nextSelection).toEqual(sel(0, 5))
  })

  it('nests bold inside italic without disturbing the italic markers', () => {
    const value = '_hello_'
    // bold-toggle the inner "hello" of an italic span.
    const { next } = toggleEmphasis(value, sel(1, 6), 'bold')
    expect(next).toBe('_**hello**_')
  })

  it('round-trips bold on a word selection', () => {
    const value = 'alpha beta gamma'
    const first = toggleEmphasis(value, sel(6, 10), 'bold')
    expect(first.next).toBe('alpha **beta** gamma')
    // Re-toggle by selecting the inner "beta".
    const second = toggleEmphasis(first.next, sel(8, 12), 'bold')
    expect(second.next).toBe('alpha beta gamma')
  })

  it('respects different modes independently (italic does not strip bold)', () => {
    const value = '**hello**'
    const { next } = toggleEmphasis(value, sel(0, value.length), 'italic')
    // Italic should wrap, not strip the bold markers.
    expect(next).toBe('_**hello**_')
  })

  it('treats code markers as their own mode (does not strip bold)', () => {
    const value = '**hello**'
    const { next } = toggleEmphasis(value, sel(0, value.length), 'code')
    expect(next).toBe('`**hello**`')
  })

  it('strips strike markers when re-applying strike to the same range', () => {
    const value = 'pre ~~done~~ post'
    const { next } = toggleEmphasis(value, sel(4, 12), 'strike')
    expect(next).toBe('pre done post')
  })
})

describe('toggleEmphasis - defensive behaviour', () => {
  it('clamps out-of-range selections without throwing', () => {
    const { next } = toggleEmphasis('hi', sel(-3, 999), 'bold')
    expect(next).toBe('**hi**')
  })

  it('handles inverted selections (end < start) by normalising', () => {
    const { next, nextSelection } = toggleEmphasis('hello', sel(5, 0), 'bold')
    expect(next).toBe('**hello**')
    expect(nextSelection).toEqual(sel(2, 7))
  })

  it('does not corrupt content outside the selection', () => {
    const value = 'prefix XXXX suffix'
    const { next } = toggleEmphasis(value, sel(7, 11), 'italic')
    expect(next.startsWith('prefix ')).toBe(true)
    expect(next.endsWith(' suffix')).toBe(true)
  })

  it('returns identical output for every emphasis mode shape', () => {
    const modes: EmphasisMode[] = ['bold', 'italic', 'code', 'strike']
    for (const mode of modes) {
      const { next } = toggleEmphasis('word', sel(0, 4), mode)
      const marker = EMPHASIS_MARKERS[mode]
      expect(next).toBe(`${marker}word${marker}`)
    }
  })
})

describe('matchEmphasisShortcut', () => {
  it('matches Cmd+B to bold', () => {
    expect(
      matchEmphasisShortcut({ code: 'KeyB', shiftKey: false, metaKey: true, ctrlKey: false }),
    ).toBe('bold')
  })

  it('matches Ctrl+I to italic', () => {
    expect(
      matchEmphasisShortcut({ code: 'KeyI', shiftKey: false, metaKey: false, ctrlKey: true }),
    ).toBe('italic')
  })

  it('matches Cmd+` to code', () => {
    expect(
      matchEmphasisShortcut({ code: 'Backquote', shiftKey: false, metaKey: true, ctrlKey: false }),
    ).toBe('code')
  })

  it('matches Cmd+Shift+X to strike', () => {
    expect(
      matchEmphasisShortcut({ code: 'KeyX', shiftKey: true, metaKey: true, ctrlKey: false }),
    ).toBe('strike')
  })

  it('does not match Cmd+X (cut) as strike (shift required)', () => {
    expect(
      matchEmphasisShortcut({ code: 'KeyX', shiftKey: false, metaKey: true, ctrlKey: false }),
    ).toBeNull()
  })

  it('does not match plain B (no modifier)', () => {
    expect(
      matchEmphasisShortcut({ code: 'KeyB', shiftKey: false, metaKey: false, ctrlKey: false }),
    ).toBeNull()
  })

  it('exposes a shortcut for every emphasis mode', () => {
    const modes = new Set(EMPHASIS_SHORTCUTS.map((shortcut) => shortcut.mode))
    expect(modes.has('bold')).toBe(true)
    expect(modes.has('italic')).toBe(true)
    expect(modes.has('code')).toBe(true)
    expect(modes.has('strike')).toBe(true)
  })
})
