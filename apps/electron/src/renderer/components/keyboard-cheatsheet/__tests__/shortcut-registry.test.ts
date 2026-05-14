/**
 * shortcut-registry.test.ts (M.10 T240-cheatsheet)
 *
 * Pure-data tests for the cheatsheet registry. Covers shape, freeze
 * semantics, EMPHASIS_SHORTCUTS round-trip, and grouping behaviour. No
 * React, no DOM — runs under bun:test directly.
 */

import { describe, expect, it } from 'bun:test'

import {
  EMPHASIS_SHORTCUTS,
} from '../../app-shell/input/emphasis-mode'
import {
  SHORTCUT_REGISTRY,
  SHORTCUT_SECTIONS,
  emphasisShortcutToEntry,
  groupShortcuts,
  type ShortcutEntry,
} from '../shortcut-registry'

describe('SHORTCUT_REGISTRY shape', () => {
  it('is frozen so consumers cannot mutate the public registry', () => {
    expect(Object.isFrozen(SHORTCUT_REGISTRY)).toBe(true)
    expect(Object.isFrozen(SHORTCUT_SECTIONS)).toBe(true)
  })

  it('emits a row for every emphasis shortcut, keyed by mode', () => {
    for (const shortcut of EMPHASIS_SHORTCUTS) {
      const expected = emphasisShortcutToEntry(shortcut)
      const match = SHORTCUT_REGISTRY.find(
        (e) => e.descriptionKey === expected.descriptionKey,
      )
      expect(match).toBeDefined()
      expect(match?.display).toBe(shortcut.display)
      expect(match?.section).toBe('composer')
    }
  })

  it('covers all three documented sections', () => {
    const seen = new Set<string>()
    for (const entry of SHORTCUT_REGISTRY) seen.add(entry.section)
    expect(seen.has('composer')).toBe(true)
    expect(seen.has('navigation')).toBe(true)
    expect(seen.has('settings')).toBe(true)
  })

  it('uses cheatsheet.* description keys (so i18n parity catches drift)', () => {
    for (const entry of SHORTCUT_REGISTRY) {
      expect(entry.descriptionKey.startsWith('cheatsheet.')).toBe(true)
    }
  })

  it('exposes a Cmd+/ entry so the binding is self-documenting', () => {
    const cheatsheetEntry = SHORTCUT_REGISTRY.find(
      (e) => e.display === 'Cmd+/',
    )
    expect(cheatsheetEntry).toBeDefined()
    expect(cheatsheetEntry?.section).toBe('settings')
  })

  it('declares each emphasis mode exactly once', () => {
    const emphasisKeys = SHORTCUT_REGISTRY
      .map((e) => e.descriptionKey)
      .filter((k) => k.startsWith('cheatsheet.entry.emphasis.'))
    const unique = new Set(emphasisKeys)
    expect(emphasisKeys.length).toBe(unique.size)
    expect(emphasisKeys.length).toBe(EMPHASIS_SHORTCUTS.length)
  })
})

describe('groupShortcuts', () => {
  it('returns a map keyed by every known section, in display order', () => {
    const grouped = groupShortcuts()
    const keys = Array.from(grouped.keys())
    expect(keys).toEqual([...SHORTCUT_SECTIONS])
  })

  it('preserves entry order within each section', () => {
    const grouped = groupShortcuts()
    const composer = grouped.get('composer') ?? []
    // First four composer rows must be the emphasis shortcuts in their
    // declared order — downstream UI relies on this for muscle memory.
    for (let i = 0; i < EMPHASIS_SHORTCUTS.length; i += 1) {
      expect(composer[i]?.display).toBe(EMPHASIS_SHORTCUTS[i]!.display)
    }
  })

  it('freezes the per-section arrays it returns', () => {
    const grouped = groupShortcuts()
    for (const section of SHORTCUT_SECTIONS) {
      const arr = grouped.get(section)
      expect(arr).toBeDefined()
      expect(Object.isFrozen(arr)).toBe(true)
    }
  })

  it('groups a caller-supplied entry list when one is passed', () => {
    const custom: ShortcutEntry[] = [
      { section: 'navigation', display: 'Tab', descriptionKey: 'cheatsheet.test.x' },
      { section: 'composer', display: 'Cmd+J', descriptionKey: 'cheatsheet.test.y' },
    ]
    const grouped = groupShortcuts(custom)
    expect(grouped.get('navigation')?.length).toBe(1)
    expect(grouped.get('composer')?.length).toBe(1)
    expect(grouped.get('settings')?.length).toBe(0)
  })
})
