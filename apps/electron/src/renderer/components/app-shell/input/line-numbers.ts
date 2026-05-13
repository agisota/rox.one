/**
 * line-numbers.ts (M.10 T236)
 *
 * Pure, framework-agnostic helpers backing the composer line-numbers gutter
 * shown when the composer is in expanded mode. The gutter renders a
 * right-aligned column of `1..N` numbers next to the textarea so authors can
 * orient themselves when drafting long prompts.
 *
 * This module is intentionally tiny and DOM-free so it can be unit-tested in
 * isolation under `bun:test`. The accompanying `LineNumbersGutter.tsx`
 * consumes `countLines` to determine how many `<span>` rows to emit.
 */

/**
 * Count the number of visible lines in `value`.
 *
 * Semantics:
 * - An empty string still has one line (the caret is on row 1).
 * - Each `\n` introduces a new line. A trailing newline therefore counts an
 *   extra empty line — matching the textarea's visual cursor position when
 *   the user has just pressed Enter at the end of input.
 * - `\r\n` Windows line endings are treated identically (the `\n` is what
 *   matters; the lone `\r` is ignored as far as the gutter is concerned).
 * - Lone `\r` (old-Mac line endings) is not counted. Modern textareas
 *   normalise to `\n` so the gutter follows that convention.
 *
 * @param value - the raw textarea value (may be empty or contain newlines)
 * @returns the number of rows the gutter should render; always ≥ 1
 */
export function countLines(value: string): number {
  if (typeof value !== 'string' || value.length === 0) return 1
  let count = 1
  for (let i = 0; i < value.length; i += 1) {
    if (value.charCodeAt(i) === 10) count += 1 // '\n'
  }
  return count
}

/**
 * Build a sequential `[1, 2, … N]` array suitable for rendering as gutter
 * rows. Kept as a thin convenience over `countLines` so the gutter component
 * can render via `.map` without computing the count twice.
 *
 * @param value - the raw textarea value
 * @returns the array of line numbers to render in the gutter
 */
export function buildLineNumbers(value: string): readonly number[] {
  const total = countLines(value)
  const out: number[] = new Array(total)
  for (let i = 0; i < total; i += 1) {
    out[i] = i + 1
  }
  return out
}
