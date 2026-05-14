/**
 * Migration contract for CodeBlock (M.11 / T173, second site).
 *
 * `CodeBlock` now resolves languages via `resolveLanguage` and renders via
 * `getSingletonHighlighter().highlight(code, lang, { theme })` from
 * `@rox-one/shared/highlight`, instead of importing `codeToHtml`,
 * `bundledLanguages` and `BundledLanguage` from the raw `shiki` package.
 *
 * This test pins the pieces of the singleton contract that CodeBlock relies
 * on. We don't render the React component itself (the renderer's RTL
 * config requires worktree-local node_modules, which is not provisioned in
 * this agent worktree); instead we test the exact module-level pipeline the
 * component uses end-to-end:
 *
 *   1. resolveLanguage covers the alias map CodeBlock used to maintain in
 *      its own LANGUAGE_ALIASES (js, ts, py, sh, yml, rb, rs, kt) and falls
 *      back to null for unknown ids — matched by the `?? 'text'` arm in
 *      the migrated component.
 *   2. The singleton renders `<pre><code>…</code></pre>` HTML so the inner
 *      HTML mount in CodeBlock produces token spans (the visible signal
 *      for syntax highlighting).
 *   3. Both `github-light` and `github-dark` themes are honoured — these
 *      are the two themes CodeBlock derives from the
 *      `document.documentElement.classList.contains('dark')` fallback.
 *   4. Repeat calls with the same inputs are deterministic — required so
 *      CodeBlock's LRU cache keyed by `${theme}:${lang}:${code}` does not
 *      mask a real change.
 *   5. Language fallback for unsupported fences renders without throwing.
 *   6. The singleton's reset path rebuilds cleanly (HMR / test reload).
 */

import { afterEach, describe, expect, setDefaultTimeout, test } from 'bun:test'
import {
  type CreateShikiHighlighterOptions,
  getSingletonHighlighter,
  resetSingletonHighlighter,
  resolveLanguage,
} from '@rox-one/shared/highlight'

setDefaultTimeout(30_000)

const TEST_HIGHLIGHTER_OPTIONS = {
  langs: ['javascript', 'typescript'],
  themes: ['github-light', 'github-dark'],
} as const satisfies CreateShikiHighlighterOptions

const getTestHighlighter = () => getSingletonHighlighter(TEST_HIGHLIGHTER_OPTIONS)

afterEach(() => {
  resetSingletonHighlighter()
})

describe('CodeBlock singleton wiring', () => {
  test('resolveLanguage handles the alias set CodeBlock used to own', () => {
    expect(resolveLanguage('js')).toBe('javascript')
    expect(resolveLanguage('ts')).toBe('typescript')
    expect(resolveLanguage('py')).toBe('python')
    expect(resolveLanguage('sh')).toBe('bash')
    expect(resolveLanguage('yml')).toBe('yaml')
    expect(resolveLanguage('rb')).toBe('ruby')
    expect(resolveLanguage('rs')).toBe('rust')
    expect(resolveLanguage('kt')).toBe('kotlin')
  })

  test('resolveLanguage returns null for fences CodeBlock should treat as text', () => {
    expect(resolveLanguage('not-a-real-language')).toBeNull()
    expect(resolveLanguage('')).toBeNull()
    expect(resolveLanguage(null)).toBeNull()
    expect(resolveLanguage(undefined)).toBeNull()
  })

  test('singleton renders a <pre><code><span> shell so CodeBlock can render markup', async () => {
    const highlighter = await getTestHighlighter()
    const html = await highlighter.highlight(
      'const value: number = 42',
      'typescript',
      { theme: 'github-light' },
    )
    // CodeBlock renders the full <pre><code>…</code></pre> directly, so
    // the shell shape and at least one token span matter for the visual
    // highlight.
    expect(html.startsWith('<pre')).toBe(true)
    expect(html.includes('<code')).toBe(true)
    expect(html.includes('<span')).toBe(true)
  })

  test('singleton honours both github-light and github-dark themes', async () => {
    const highlighter = await getTestHighlighter()
    const code = 'function id<T>(x: T): T { return x }'
    const light = await highlighter.highlight(code, 'typescript', { theme: 'github-light' })
    const dark = await highlighter.highlight(code, 'typescript', { theme: 'github-dark' })
    expect(light).toMatch(/<pre[^>]*><code/)
    expect(dark).toMatch(/<pre[^>]*><code/)
    // Theme-specific output must differ so dark-mode renders the correct
    // colour scheme — the CodeBlock theme fallback would be meaningless
    // otherwise.
    expect(light).not.toBe(dark)
  })

  test('singleton output is deterministic per (code, lang, theme) — CodeBlock LRU contract', async () => {
    const highlighter = await getTestHighlighter()
    const code = "console.log('hi')"
    const a = await highlighter.highlight(code, 'javascript', { theme: 'github-light' })
    const b = await highlighter.highlight(code, 'javascript', { theme: 'github-light' })
    expect(a).toBe(b)
  })

  test('singleton renders unsupported language as plain text without throwing', async () => {
    const highlighter = await getTestHighlighter()
    // CodeBlock relies on the adapter's graceful fallback because its own
    // resolveLanguage(...) ?? 'text' arm passes literal 'text' down.
    const html = await highlighter.highlight('# heading', 'text', { theme: 'github-light' })
    expect(html).toMatch(/<pre[^>]*><code/)
  })

  test('resetSingletonHighlighter rebuilds cleanly — HMR / test reload path', async () => {
    const a = await getTestHighlighter()
    resetSingletonHighlighter()
    const b = await getTestHighlighter()
    expect(a).not.toBe(b)
    const html = await b.highlight('let n = 1', 'typescript', { theme: 'github-light' })
    expect(html.includes('<span')).toBe(true)
  })
})
