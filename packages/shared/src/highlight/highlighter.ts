/**
 * Highlighter adapter — engine-agnostic syntax highlighting surface.
 *
 * Callers depend on the `Highlighter` interface, not on Shiki (or any other
 * engine) directly. This lets us swap engines (Shiki ↔ Prism ↔ Highlight.js)
 * without touching call sites.
 *
 * The current backing implementation is Shiki 3.x using the JS-regex engine
 * (no WASM) with a curated preloaded subset of languages and themes.
 * See `docs/decision-records/audit-harness/0010-shiki-highlighter.md` for
 * the rationale (Phase 11 / F.1 Shiki migration, Option A).
 */

import {
  createHighlighterCore,
  type HighlighterCore,
} from '@shikijs/core'
import { createJavaScriptRegexEngine } from '@shikijs/engine-javascript'

import { PRELOADED_LANGUAGES, type SupportedLanguage } from './languages'
import { PRELOADED_THEMES, type SupportedTheme, DEFAULT_LIGHT_THEME, DEFAULT_DARK_THEME } from './themes'

/**
 * Engine-agnostic highlighter surface used by all callers in the app.
 *
 * Implementations must:
 * - Be deterministic: `highlight(code, lang)` returns identical output for
 *   identical inputs.
 * - Resolve unsupported languages gracefully — typically by falling back to
 *   `'text'` rather than throwing.
 * - Render to a `<pre><code>…</code></pre>` HTML string with `<span>` tokens
 *   inside; output is trusted because it is produced by the highlighter and
 *   wraps caller-provided source text in escaped form.
 */
export interface Highlighter {
  /**
   * Render `code` to highlighted HTML with token spans wrapping each lexeme.
   */
  highlight(code: string, lang: string, opts?: { theme?: string }): Promise<string>
  /** The language names supported without dynamic loading. */
  supportedLanguages(): ReadonlyArray<string>
  /** The theme names supported without dynamic loading. */
  supportedThemes(): ReadonlyArray<string>
  /** True if the engine can highlight `lang` synchronously. */
  isLanguageSupported(lang: string): boolean
  /** True if the engine has loaded `theme`. */
  isThemeSupported(theme: string): boolean
}

export type CreateShikiHighlighterOptions = {
  themes?: ReadonlyArray<SupportedTheme>
  langs?: ReadonlyArray<SupportedLanguage>
  defaultTheme?: SupportedTheme
}

/**
 * Build a Shiki-backed highlighter using the JS-regex engine (no WASM).
 *
 * The factory eagerly resolves the requested grammars and themes so subsequent
 * `highlight()` calls are synchronous from the engine's perspective. The
 * Promise resolves once preload is complete.
 */
export async function createShikiHighlighter(
  opts: CreateShikiHighlighterOptions = {}
): Promise<Highlighter> {
  const requestedLangs = opts.langs ?? PRELOADED_LANGUAGES
  const requestedThemes = opts.themes ?? PRELOADED_THEMES
  const defaultTheme = opts.defaultTheme ?? DEFAULT_LIGHT_THEME

  // Dynamic per-language imports keep tree-shaking healthy: bundlers only
  // include the grammars we actually preload. The Shiki core mutates the
  // grammar/theme objects it ingests (e.g. it adds compiled regex state to
  // each pattern), so each highlighter instance gets its own deep copy to
  // prevent cross-instance state bleed.
  const langModules = await Promise.all(
    requestedLangs.map((lang) =>
      import(`@shikijs/langs/${lang}`).then((m) => structuredClone(m.default))
    )
  )
  const themeModules = await Promise.all(
    requestedThemes.map((theme) =>
      import(`@shikijs/themes/${theme}`).then((m) => structuredClone(m.default))
    )
  )

  // Pass an explicit per-instance regex cache and `forgiving: true` so the
  // JS-regex engine silently skips patterns it cannot translate from
  // Oniguruma syntax. Without `forgiving`, the first call on a fresh
  // highlighter under-tokenizes because some patterns throw during lazy
  // compilation; subsequent calls render differently as the cache primes.
  const core: HighlighterCore = await createHighlighterCore({
    engine: createJavaScriptRegexEngine({ cache: new Map(), forgiving: true }),
    langs: langModules,
    themes: themeModules,
  })

  const supportedLangs = new Set<string>(core.getLoadedLanguages())
  const supportedThemes = new Set<string>(core.getLoadedThemes())

  // Warm the JS-regex engine: the first tokenisation of each grammar is
  // under-tokenized because patterns are lazily compiled and the engine's
  // pattern cache primes incrementally. Two passes of a rich sample per
  // language primes the cache deeply enough that every subsequent
  // caller-visible call is deterministic.
  const WARMUP_SAMPLE = [
    '"a string"',
    "'another'",
    '`template ${x}`',
    '/* comment */',
    '// line',
    '0x1A 1.0 1_000',
    'function f(x) { return [x, {a: 1}]; }',
    'class C extends B { p = 1 }',
    'if (a && b || !c) for (;;) {}',
    'a.b?.c ?? d',
  ].join('\n')
  for (const lang of supportedLangs) {
    if (lang === 'text') continue
    for (let i = 0; i < 2; i++) {
      try {
        core.codeToHtml(WARMUP_SAMPLE, { lang, theme: defaultTheme })
      } catch {
        // grammar may reject the sample; the attempt still primes the cache.
      }
    }
  }

  return {
    async highlight(code, lang, { theme } = {}) {
      const resolvedLang = supportedLangs.has(lang) ? lang : 'text'
      const resolvedTheme = theme && supportedThemes.has(theme) ? theme : defaultTheme
      return core.codeToHtml(code, {
        lang: resolvedLang,
        theme: resolvedTheme,
      })
    },
    supportedLanguages() {
      return [...supportedLangs]
    },
    supportedThemes() {
      return [...supportedThemes]
    },
    isLanguageSupported(lang) {
      return supportedLangs.has(lang)
    },
    isThemeSupported(theme) {
      return supportedThemes.has(theme)
    },
  }
}

export { PRELOADED_LANGUAGES, PRELOADED_THEMES, DEFAULT_LIGHT_THEME, DEFAULT_DARK_THEME }
export type { SupportedLanguage, SupportedTheme }
