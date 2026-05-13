/**
 * Public re-exports for the highlight adapter.
 * Consumers should import from `@rox-one/shared/highlight`.
 */

export {
  createShikiHighlighter,
  type Highlighter,
  type CreateShikiHighlighterOptions,
} from './highlighter'
export { getSingletonHighlighter, resetSingletonHighlighter } from './singleton'
export {
  PRELOADED_LANGUAGES,
  LANGUAGE_ALIASES,
  resolveLanguage,
  type SupportedLanguage,
} from './languages'
export {
  PRELOADED_THEMES,
  DEFAULT_LIGHT_THEME,
  DEFAULT_DARK_THEME,
  resolveTheme,
  type SupportedTheme,
} from './themes'
