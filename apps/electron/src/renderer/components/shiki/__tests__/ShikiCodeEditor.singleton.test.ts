/**
 * Migration contract for ShikiCodeEditor (M.11 / T173).
 *
 * `ShikiCodeEditor` now calls the shared singleton highlighter from
 * `@rox-one/shared/highlight` instead of importing `codeToHtml` from the
 * raw `shiki` package. The component is a thin async wrapper over
 * `highlighter.highlight(code, lang, { theme })`, then strips the outer
 * `<pre><code>…</code></pre>` shell before handing the inner markup to
 * react-simple-code-editor.
 *
 * This test pins the contract that the migrated code relies on:
 *   1. The singleton resolves to the same instance across calls.
 *   2. `highlight(code, 'typescript', { theme: 'github-light' })` returns
 *      a `<pre><code>…</code></pre>` shell with `<span>`-wrapped tokens
 *      inside (so the editor's regex strip can do its work).
 *   3. The inner-markup match used by ShikiCodeEditor produces non-empty
 *      content with at least one token span.
 *   4. Unknown / non-preloaded language names resolve gracefully via the
 *      `resolveLanguage` helper (the migration's language fallback).
 *   5. Theme + language combinations are deterministic — repeat calls
 *      return byte-identical output (matches the highlight-corpus
 *      contract used by the shared package).
 *   6. The singleton survives a reset and rebuilds cleanly (mirrors HMR
 *      and renderer test reload paths).
 */

import { afterEach, describe, expect, test } from 'bun:test'
import {
  getSingletonHighlighter,
  resetSingletonHighlighter,
  resolveLanguage,
} from '@rox-one/shared/highlight'

// Mirror the regex that ShikiCodeEditor uses to peel the <pre><code>…
// shell off the singleton output before handing it to the editor. Keep this
// in lockstep with the component itself — a divergence here is a migration
// regression.
const INNER_MARKUP_RE = /<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/

afterEach(() => {
  resetSingletonHighlighter()
})

describe('ShikiCodeEditor singleton wiring', () => {
  test('getSingletonHighlighter returns the same instance across calls', async () => {
    const a = await getSingletonHighlighter()
    const b = await getSingletonHighlighter()
    expect(a).toBe(b)
  })

  test('singleton renders a <pre><code><span> shell for typescript source', async () => {
    const highlighter = await getSingletonHighlighter()
    const html = await highlighter.highlight(
      'function greet(name: string) { return name }',
      'typescript',
      { theme: 'github-light' },
    )
    expect(html.startsWith('<pre')).toBe(true)
    expect(html.includes('<code')).toBe(true)
    expect(html.includes('<span')).toBe(true)
  })

  test('ShikiCodeEditor inner-markup strip yields non-empty token spans', async () => {
    const highlighter = await getSingletonHighlighter()
    const code = 'class C { p = 1 }'
    const html = await highlighter.highlight(code, 'typescript', { theme: 'github-light' })
    const match = html.match(INNER_MARKUP_RE)
    expect(match).not.toBeNull()
    const inner = match![1]
    expect(inner.length).toBeGreaterThan(0)
    // At least one token span in the inner content — the editor relies on
    // this so the textarea overlay shows highlighted output.
    expect(inner.includes('<span')).toBe(true)
  })

  test('resolveLanguage falls back to null for unknown language names', () => {
    // The migrated ShikiCodeEditor uses `resolveLanguage(input) ?? 'text'`
    // to handle user-typed fences. Both arms of that fallback matter:
    expect(resolveLanguage('typescript')).toBe('typescript')
    expect(resolveLanguage('ts')).toBe('typescript')
    expect(resolveLanguage('not-a-real-language')).toBeNull()
    expect(resolveLanguage('')).toBeNull()
  })

  test('singleton highlight output is deterministic for repeat calls', async () => {
    const highlighter = await getSingletonHighlighter()
    const code = 'const x = 42'
    const first = await highlighter.highlight(code, 'typescript', { theme: 'github-light' })
    const second = await highlighter.highlight(code, 'typescript', { theme: 'github-light' })
    expect(first).toBe(second)
  })

  test('resetSingletonHighlighter forces a fresh build but keeps the contract', async () => {
    const before = await getSingletonHighlighter()
    resetSingletonHighlighter()
    const after = await getSingletonHighlighter()
    expect(after).not.toBe(before)
    // The new instance must still render the documented shell shape.
    const html = await after.highlight('const x = 1', 'typescript', { theme: 'github-light' })
    expect(html).toMatch(INNER_MARKUP_RE)
  })

  test('singleton honours an unsupported theme by falling back to its default', async () => {
    const highlighter = await getSingletonHighlighter()
    // The adapter contract guarantees graceful fallback for unsupported
    // themes — the migrated component relies on this so it cannot throw
    // when a theme.json preset is mid-migration.
    const html = await highlighter.highlight('let n = 1', 'typescript', { theme: 'not-a-real-theme' })
    expect(html).toMatch(INNER_MARKUP_RE)
  })
})
