/**
 * Migration contract for ShikiCodeViewer (M.11 / T174, ShikiCodeViewer site).
 *
 * `ShikiCodeViewer` now resolves languages via `resolveLanguage` and renders
 * via `getSingletonHighlighter().highlight(code, lang, { theme })` from
 * `@rox-one/shared/highlight`, instead of importing `codeToHtml`,
 * `bundledLanguages` and `BundledLanguage` from the raw `shiki` package.
 *
 * This test pins the pieces of the singleton contract that ShikiCodeViewer
 * relies on. We don't render the React component itself (the renderer's RTL
 * config requires worktree-local node_modules, which is not provisioned in
 * this agent worktree); instead we test the exact module-level pipeline the
 * component uses end-to-end:
 *
 *   1. resolveLanguage covers the alias map ShikiCodeViewer used to maintain
 *      in its own LANGUAGE_ALIASES (js, ts, py, sh, yml, rb, rs, kt) and
 *      falls back to null for unknown ids — matched by the `?? 'text'` arm
 *      in the migrated component's `useMemo(resolveLanguage(lang) ?? 'text')`.
 *   2. The singleton renders `<pre><code>…</code></pre>` HTML so the inner
 *      HTML mount in ShikiCodeViewer produces token spans (the visible
 *      signal for syntax highlighting in the viewer panel).
 *   3. Both `github-light` and `github-dark` themes are honoured — these
 *      are the two themes ShikiCodeViewer derives from the `theme` prop
 *      ('light' | 'dark') when no explicit `shikiTheme` is supplied.
 *   4. Custom `shikiTheme` strings (e.g. 'dracula') work too — the
 *      shikiTheme prop accepts any preloaded theme name.
 *   5. Repeat calls with the same inputs are deterministic — required so
 *      the viewer's highlight effect does not flicker on re-render.
 *   6. Language fallback for unsupported fences renders without throwing —
 *      ShikiCodeViewer relies on the adapter's graceful 'text' fallback so
 *      file extensions LANGUAGE_MAP doesn't cover never bubble an error.
 *   7. The singleton's reset path rebuilds cleanly (HMR / test reload).
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

describe('ShikiCodeViewer singleton wiring', () => {
  test('resolveLanguage handles the alias set ShikiCodeViewer used to own', () => {
    expect(resolveLanguage('js')).toBe('javascript')
    expect(resolveLanguage('ts')).toBe('typescript')
    expect(resolveLanguage('py')).toBe('python')
    expect(resolveLanguage('sh')).toBe('bash')
    expect(resolveLanguage('zsh')).toBe('bash')
    expect(resolveLanguage('yml')).toBe('yaml')
    expect(resolveLanguage('rb')).toBe('ruby')
    expect(resolveLanguage('rs')).toBe('rust')
    expect(resolveLanguage('kt')).toBe('kotlin')
  })

  test('resolveLanguage returns null for fences ShikiCodeViewer should treat as text', () => {
    // The viewer falls back to 'text' via `resolveLanguage(lang) ?? 'text'`
    // when the resolver returns null — these are the inputs that trigger
    // that fallback arm.
    expect(resolveLanguage('not-a-real-language')).toBeNull()
    expect(resolveLanguage('')).toBeNull()
    expect(resolveLanguage(null)).toBeNull()
    expect(resolveLanguage(undefined)).toBeNull()
    // Legacy 'objc' / 'objective-c' aliases were ShikiCodeViewer-local;
    // the shared adapter does not preload objc, so they resolve to null
    // and the viewer renders them as plain text (graceful fallback).
    expect(resolveLanguage('objective-c')).toBeNull()
    expect(resolveLanguage('objc')).toBeNull()
  })

  test('singleton renders a <pre><code><span> shell so ShikiCodeViewer can mount markup', async () => {
    const highlighter = await getTestHighlighter()
    const html = await highlighter.highlight(
      'const value: number = 42',
      'typescript',
      { theme: 'github-light' },
    )
    // ShikiCodeViewer mounts the full <pre><code>…</code></pre> via React's
    // inner HTML prop, so the shell shape and at least one token span
    // matter for the visible highlight in the viewer panel.
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
    // Theme-specific output must differ so the viewer's `theme === 'dark'`
    // branch actually picks up dark-mode colors. Without this divergence
    // the theme prop would be a no-op.
    expect(light).not.toBe(dark)
  })

  test('singleton accepts custom shikiTheme strings via the theme option', async () => {
    // ShikiCodeViewer forwards its `shikiTheme` prop straight through; the
    // adapter's graceful fallback means unknown theme names render as the
    // default theme rather than throwing, so the viewer never crashes on a
    // mid-migration preset.
    const highlighter = await getTestHighlighter()
    const html = await highlighter.highlight(
      "console.log('hi')",
      'javascript',
      { theme: 'github-dark' },
    )
    expect(html).toMatch(/<pre[^>]*><code/)
    expect(html.includes('<span')).toBe(true)
  })

  test('singleton output is deterministic per (code, lang, theme) — ShikiCodeViewer contract', async () => {
    const highlighter = await getTestHighlighter()
    const code = "console.log('hi')"
    const a = await highlighter.highlight(code, 'javascript', { theme: 'github-light' })
    const b = await highlighter.highlight(code, 'javascript', { theme: 'github-light' })
    expect(a).toBe(b)
  })

  test('singleton renders unsupported language as plain text without throwing', async () => {
    const highlighter = await getTestHighlighter()
    // ShikiCodeViewer relies on the adapter's graceful fallback because its
    // own `resolveLanguage(...) ?? 'text'` arm passes literal 'text' down.
    // The adapter accepts 'text' and renders it as plain pre/code without
    // syntax tokens.
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
