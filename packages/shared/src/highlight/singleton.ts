/**
 * Lazy singleton wrapper around `createShikiHighlighter`.
 *
 * Most callers want a process-wide shared instance because building a fresh
 * highlighter is expensive (per-grammar warmup + theme deserialisation).
 * The singleton is constructed on first use and re-used thereafter; tests
 * that need isolation should call `createShikiHighlighter()` directly.
 */

import { createShikiHighlighter, type Highlighter, type CreateShikiHighlighterOptions } from './highlighter'

let promise: Promise<Highlighter> | null = null

/**
 * Return the process-wide highlighter, building it on first call.
 *
 * Subsequent calls return the same Promise. Options are honoured only on the
 * first call — pass `null` first or call `resetSingletonHighlighter()` to
 * change configuration.
 */
export function getSingletonHighlighter(opts?: CreateShikiHighlighterOptions): Promise<Highlighter> {
  if (!promise) {
    promise = createShikiHighlighter(opts)
  }
  return promise
}

/** Drop the cached singleton. Intended for tests and HMR. */
export function resetSingletonHighlighter(): void {
  promise = null
}
