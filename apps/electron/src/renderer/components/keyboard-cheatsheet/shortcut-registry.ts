/**
 * shortcut-registry.ts (M.10 T240-cheatsheet)
 *
 * Pure data describing every keyboard shortcut that the user can invoke
 * globally. Consumed by `CheatsheetOverlay` (Cmd+/) to render a grouped
 * reference card without coupling the overlay to React state from the
 * individual feature surfaces (composer, navigation, settings).
 *
 * Why a registry instead of asking each surface to surface its own shortcut?
 *  - The cheatsheet is a single, flat overlay. Walking React refs to discover
 *    bindings would be brittle and order-dependent.
 *  - The composer emphasis shortcuts ship as a frozen array
 *    (`EMPHASIS_SHORTCUTS` in `emphasis-mode.ts`). Aggregating them here
 *    re-uses the existing source of truth — we never duplicate the binding
 *    metadata, only the human description.
 *  - Navigation/settings shortcuts live in many places (App.tsx, AppShell,
 *    menu items) and are not currently centralised. The cheatsheet is the
 *    first surface that needs the *complete* list; rather than refactor
 *    every owner today, we hand-roll a snapshot here and unit-test the
 *    shape. Owners that change a binding will fail the existing parity
 *    checks (T234-T239 surfaces are read-only from our point of view).
 *
 * Sections map 1:1 onto the i18n keys `cheatsheet.section.<id>`. Adding a
 * new section requires (a) adding the id below, (b) extending the i18n
 * dictionaries in all 8 locales, and (c) extending the section test.
 */

import { EMPHASIS_SHORTCUTS, type EmphasisShortcut } from '../app-shell/input/emphasis-mode'

/** Logical group used by the overlay to order and label shortcuts. */
export type ShortcutSectionId = 'composer' | 'navigation' | 'settings'

/**
 * One row in the cheatsheet. `display` is the platform-neutral hint we
 * paint inside `<kbd>` chips — the helper that consumes the overlay is
 * free to substitute Cmd / Ctrl glyphs based on `lib/platform.isMac`.
 *
 * `descriptionKey` resolves through i18next; it is *not* a literal label,
 * so consumers must translate via `t()` before painting. We deliberately
 * keep the literal English label out of the registry so locale parity is
 * enforced through the standard i18n pipeline.
 */
export interface ShortcutEntry {
  readonly section: ShortcutSectionId
  readonly display: string
  readonly descriptionKey: string
}

/**
 * Map an emphasis shortcut into a cheatsheet entry. Exposed for tests so
 * we can assert that every entry in `EMPHASIS_SHORTCUTS` makes it into
 * the composer section without drift.
 */
export function emphasisShortcutToEntry(s: EmphasisShortcut): ShortcutEntry {
  return {
    section: 'composer',
    display: s.display,
    descriptionKey: `cheatsheet.entry.emphasis.${s.mode}`,
  }
}

/**
 * Composer section. Bold / italic / code / strike come straight from
 * EMPHASIS_SHORTCUTS so changes there propagate automatically. Send,
 * new-line, escape are surfaced for parity with the existing component-
 * specific dialog (see KeyboardShortcutsDialog).
 */
const composerExtras: readonly ShortcutEntry[] = Object.freeze([
  {
    section: 'composer',
    display: 'Enter',
    descriptionKey: 'cheatsheet.entry.composer.send',
  },
  {
    section: 'composer',
    display: 'Shift+Enter',
    descriptionKey: 'cheatsheet.entry.composer.newline',
  },
  {
    section: 'composer',
    display: 'Esc',
    descriptionKey: 'cheatsheet.entry.composer.close',
  },
  {
    section: 'composer',
    display: 'Cmd+V',
    descriptionKey: 'cheatsheet.entry.composer.pasteImage',
  },
])

/** Navigation: list movement, session jumps, agent-tree expand/collapse. */
const navigation: readonly ShortcutEntry[] = Object.freeze([
  {
    section: 'navigation',
    display: '↑ / ↓',
    descriptionKey: 'cheatsheet.entry.navigation.listMove',
  },
  {
    section: 'navigation',
    display: '← / →',
    descriptionKey: 'cheatsheet.entry.navigation.treeToggle',
  },
  {
    section: 'navigation',
    display: 'Home / End',
    descriptionKey: 'cheatsheet.entry.navigation.listEdges',
  },
  {
    section: 'navigation',
    display: 'Enter',
    descriptionKey: 'cheatsheet.entry.navigation.openSelection',
  },
])

/** Settings: opening the settings UI / shortcuts dialog / cheatsheet itself. */
const settings: readonly ShortcutEntry[] = Object.freeze([
  {
    section: 'settings',
    display: 'Cmd+,',
    descriptionKey: 'cheatsheet.entry.settings.open',
  },
  {
    section: 'settings',
    display: 'Cmd+/',
    descriptionKey: 'cheatsheet.entry.settings.cheatsheet',
  },
  {
    section: 'settings',
    display: 'Cmd+N',
    descriptionKey: 'cheatsheet.entry.settings.newChat',
  },
])

/**
 * Flat, ordered registry. Order matters: the overlay paints sections in
 * insertion order. The array is frozen so callers cannot mutate it; tests
 * verify the freeze.
 */
export const SHORTCUT_REGISTRY: readonly ShortcutEntry[] = Object.freeze([
  ...EMPHASIS_SHORTCUTS.map(emphasisShortcutToEntry),
  ...composerExtras,
  ...navigation,
  ...settings,
])

/** Section ids in display order. */
export const SHORTCUT_SECTIONS: readonly ShortcutSectionId[] = Object.freeze([
  'composer',
  'navigation',
  'settings',
])

/**
 * Group the registry by section, preserving the order each entry appears
 * in `SHORTCUT_REGISTRY`. Exposed for the overlay; tests pin the shape.
 */
export function groupShortcuts(
  entries: readonly ShortcutEntry[] = SHORTCUT_REGISTRY,
): ReadonlyMap<ShortcutSectionId, readonly ShortcutEntry[]> {
  const grouped = new Map<ShortcutSectionId, ShortcutEntry[]>()
  for (const section of SHORTCUT_SECTIONS) {
    grouped.set(section, [])
  }
  for (const entry of entries) {
    const bucket = grouped.get(entry.section)
    if (bucket) bucket.push(entry)
  }
  // Freeze the inner arrays so consumers cannot mutate them.
  const out = new Map<ShortcutSectionId, readonly ShortcutEntry[]>()
  for (const [k, v] of grouped) out.set(k, Object.freeze(v.slice()))
  return out
}
