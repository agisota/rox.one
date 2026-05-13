/**
 * emphasis-mode.ts
 *
 * Pure helper for toggling markdown emphasis ("bold", "italic", "code", "strike")
 * around a textarea-style selection. Designed for the composer emphasis toolbar
 * (M.10 T235) and consumed by both the toolbar buttons and the keyboard
 * shortcut handler in FreeFormInput.
 *
 * The helper is intentionally framework-agnostic so it can be unit tested in
 * isolation (no DOM, no React). Inputs are a string value plus a {start,end}
 * selection range; outputs are the next string value and the selection range
 * that should be applied after the edit so the user's cursor stays in a
 * sensible place (selection wraps the freshly emphasised region, or sits
 * between the markers when there was no selection to begin with).
 */

export type EmphasisMode = 'bold' | 'italic' | 'code' | 'strike'

export interface EmphasisSelection {
  start: number
  end: number
}

export interface EmphasisResult {
  next: string
  nextSelection: EmphasisSelection
}

/**
 * Marker strings used for each markdown emphasis mode. Bold uses double
 * asterisks rather than double underscores because the broader product
 * convention (and most public LLM outputs) write bold with asterisks. Italic
 * uses underscores so it nests cleanly inside `**...**` without colliding
 * with bold's asterisks. Strike uses GitHub-flavoured `~~`.
 */
export const EMPHASIS_MARKERS: Readonly<Record<EmphasisMode, string>> = Object.freeze({
  bold: '**',
  italic: '_',
  code: '`',
  strike: '~~',
})

/**
 * Normalise a selection so that `start <= end` and both ends are clamped to
 * the length of the input value. Receivers may hand us inverted or
 * out-of-range ranges (e.g. when the platform reports `selectionStart >
 * selectionEnd` for a right-to-left drag). We collapse those defensively so
 * the rest of the helper can rely on a canonical range.
 */
function normaliseSelection(value: string, selection: EmphasisSelection): EmphasisSelection {
  const length = value.length
  const a = Math.max(0, Math.min(length, selection.start | 0))
  const b = Math.max(0, Math.min(length, selection.end | 0))
  return a <= b ? { start: a, end: b } : { start: b, end: a }
}

/**
 * Expand an empty selection to the surrounding word. When the cursor is
 * sitting in the middle of a word and the user hits Cmd+B (or clicks the
 * bold toolbar button) we want to emphasise the word, not insert a pair of
 * empty markers. This mirrors the behaviour of common editors (Slack, VS
 * Code's selection helpers, ProseMirror's `toggleMark`).
 *
 * A "word character" here is anything that is not whitespace and not one of
 * the structural punctuation marks we use to delimit clauses. We
 * deliberately include `_`, `*`, `~`, and backticks so that an already
 * emphasised word can be detected and toggled off rather than re-wrapped.
 */
function expandToWord(value: string, selection: EmphasisSelection): EmphasisSelection {
  if (selection.start !== selection.end) return selection
  if (value.length === 0) return selection

  // Stop expanding when we hit whitespace or sentence punctuation. We allow
  // `*_`~` inside the word so existing markers can be detected and stripped.
  const isWordChar = (ch: string): boolean => !/[\s.,;:!?()[\]{}<>"']/.test(ch)

  let start = selection.start
  let end = selection.end

  // If the cursor sits between two non-word characters we leave the
  // selection collapsed — there is nothing to emphasise and we will simply
  // insert an empty marker pair.
  const charBefore = start > 0 ? value.charAt(start - 1) : ''
  const charAfter = end < value.length ? value.charAt(end) : ''
  if (!isWordChar(charBefore) && !isWordChar(charAfter)) {
    return selection
  }

  while (start > 0 && isWordChar(value.charAt(start - 1))) start -= 1
  while (end < value.length && isWordChar(value.charAt(end))) end += 1

  return { start, end }
}

/**
 * Detect whether the slice currently wraps itself in `marker` on both sides.
 * Two surface variants are checked:
 *  1. The selection contains the markers (e.g. user selected `**hi**`).
 *  2. The selection is the inner text and the markers sit immediately
 *     outside (e.g. user selected `hi` from `**hi**`).
 *
 * Returning the markers in the result lets the caller strip them with a
 * single splice rather than re-running the search.
 */
type ExistingEmphasis =
  | { kind: 'inside'; outerStart: number; outerEnd: number; innerStart: number; innerEnd: number }
  | { kind: 'wraps'; outerStart: number; outerEnd: number; innerStart: number; innerEnd: number }
  | null

function detectExistingEmphasis(
  value: string,
  selection: EmphasisSelection,
  marker: string,
): ExistingEmphasis {
  const slice = value.slice(selection.start, selection.end)

  // Variant 1: selection includes the markers.
  if (
    slice.length >= marker.length * 2 &&
    slice.startsWith(marker) &&
    slice.endsWith(marker)
  ) {
    return {
      kind: 'wraps',
      outerStart: selection.start,
      outerEnd: selection.end,
      innerStart: selection.start + marker.length,
      innerEnd: selection.end - marker.length,
    }
  }

  // Variant 2: markers sit just outside the selection.
  const beforeStart = selection.start - marker.length
  const afterEnd = selection.end + marker.length
  if (
    beforeStart >= 0 &&
    afterEnd <= value.length &&
    value.slice(beforeStart, selection.start) === marker &&
    value.slice(selection.end, afterEnd) === marker
  ) {
    return {
      kind: 'inside',
      outerStart: beforeStart,
      outerEnd: afterEnd,
      innerStart: selection.start,
      innerEnd: selection.end,
    }
  }

  return null
}

/**
 * Apply or remove the markdown emphasis markers for `mode` around the given
 * selection within `value`. The returned `nextSelection` describes where the
 * caller should set the textarea/contenteditable selection after the value
 * has been updated.
 *
 * Behaviour summary:
 *  - Empty selection on a word -> wraps the surrounding word, selection
 *    stays around the word (now emphasised).
 *  - Empty selection in whitespace -> inserts an empty marker pair and
 *    places the caret between them.
 *  - Non-empty selection -> wraps the slice or strips the markers if the
 *    slice is already emphasised. Nested emphasis (e.g. bold inside italic)
 *    is supported because each mode operates only on its own marker.
 *
 * The helper preserves the original `value` outside the affected range
 * exactly. It never throws — out of range selections are clamped.
 */
export function toggleEmphasis(
  value: string,
  selection: EmphasisSelection,
  mode: EmphasisMode,
): EmphasisResult {
  const marker = EMPHASIS_MARKERS[mode]
  const normalised = normaliseSelection(value, selection)
  const target = expandToWord(value, normalised)

  // Case 1: empty target. Insert marker pair and place the caret between.
  if (target.start === target.end) {
    const caret = target.start
    const next = value.slice(0, caret) + marker + marker + value.slice(caret)
    const inside = caret + marker.length
    return {
      next,
      nextSelection: { start: inside, end: inside },
    }
  }

  const existing = detectExistingEmphasis(value, target, marker)

  // Case 2: existing emphasis around the selection — strip the markers.
  if (existing) {
    const before = value.slice(0, existing.outerStart)
    const middle = value.slice(existing.innerStart, existing.innerEnd)
    const after = value.slice(existing.outerEnd)
    const next = before + middle + after
    return {
      next,
      nextSelection: {
        start: existing.outerStart,
        end: existing.outerStart + middle.length,
      },
    }
  }

  // Case 3: no existing emphasis — wrap the selection with markers.
  const before = value.slice(0, target.start)
  const middle = value.slice(target.start, target.end)
  const after = value.slice(target.end)
  const next = before + marker + middle + marker + after
  return {
    next,
    nextSelection: {
      start: target.start + marker.length,
      end: target.start + marker.length + middle.length,
    },
  }
}

/**
 * Convenience description of the keyboard shortcut bound to each emphasis
 * mode. The toolbar surfaces these in tooltips (interpolated via i18n) and
 * the FreeFormInput keydown handler uses the codes for shortcut detection.
 *
 * `code` is the `KeyboardEvent.code` value to match against (locale safe);
 * `requiresShift` marks shortcuts that additionally require the shift
 * modifier (currently only strike-through: Cmd/Ctrl+Shift+X).
 */
export interface EmphasisShortcut {
  mode: EmphasisMode
  code: string
  requiresShift: boolean
  /** Human-readable label, used for accessible names. */
  label: string
  /** Display string used inside tooltips (i18n interpolated). */
  display: string
}

export const EMPHASIS_SHORTCUTS: readonly EmphasisShortcut[] = Object.freeze([
  { mode: 'bold', code: 'KeyB', requiresShift: false, label: 'Bold', display: 'Cmd+B' },
  { mode: 'italic', code: 'KeyI', requiresShift: false, label: 'Italic', display: 'Cmd+I' },
  { mode: 'code', code: 'Backquote', requiresShift: false, label: 'Code', display: 'Cmd+`' },
  { mode: 'strike', code: 'KeyX', requiresShift: true, label: 'Strike', display: 'Cmd+Shift+X' },
])

/**
 * Match a keyboard event against the emphasis shortcut table. Returns the
 * matched mode or `null` if the event does not correspond to any emphasis
 * binding. Accepts a permissive event shape so unit tests can pass plain
 * objects without constructing real `KeyboardEvent`s.
 */
export interface EmphasisKeyEvent {
  code: string
  shiftKey: boolean
  metaKey: boolean
  ctrlKey: boolean
}

export function matchEmphasisShortcut(event: EmphasisKeyEvent): EmphasisMode | null {
  // Require Cmd (macOS) or Ctrl (others) but not both, mirroring how every
  // major editor binds bold/italic.
  const cmdOrCtrl = event.metaKey || event.ctrlKey
  if (!cmdOrCtrl) return null

  for (const shortcut of EMPHASIS_SHORTCUTS) {
    if (shortcut.code !== event.code) continue
    if (shortcut.requiresShift !== event.shiftKey) continue
    return shortcut.mode
  }
  return null
}
