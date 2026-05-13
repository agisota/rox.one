/**
 * Curated set of preloaded languages for the Shiki highlighter.
 *
 * Adding a language here causes its grammar to be bundled with the
 * highlighter on app start. The set is intentionally small — every entry
 * adds disk/network cost. See ADR 0010 for the bundle-size analysis.
 *
 * Keep alphabetised within each tier; tier order is fixed to keep
 * dropdown ordering stable across builds.
 */

/**
 * Languages preloaded into the singleton highlighter at startup. Chosen to
 * cover ~95% of code-block usage observed in agent transcripts and chat
 * surfaces. New languages should be justified per ADR 0010.
 */
export const PRELOADED_LANGUAGES = [
  // Web / scripting
  'javascript',
  'typescript',
  'jsx',
  'tsx',
  'python',
  'ruby',
  'php',
  // Systems
  'go',
  'rust',
  'c',
  'cpp',
  'java',
  'kotlin',
  'swift',
  // Shell + config
  'bash',
  'shellscript',
  'json',
  'yaml',
  'sql',
  // Markup / styling
  'html',
  'css',
  'markdown',
] as const

export type SupportedLanguage = (typeof PRELOADED_LANGUAGES)[number]

/**
 * Aliases mapped to canonical Shiki language ids. Used by callers that
 * accept user-typed language names (e.g. fenced code-block info-strings).
 */
export const LANGUAGE_ALIASES: Record<string, SupportedLanguage> = {
  js: 'javascript',
  ts: 'typescript',
  py: 'python',
  rb: 'ruby',
  rs: 'rust',
  kt: 'kotlin',
  sh: 'bash',
  shell: 'shellscript',
  zsh: 'bash',
  yml: 'yaml',
  md: 'markdown',
}

/**
 * Resolve a user-supplied language string to a canonical id from
 * `PRELOADED_LANGUAGES`. Returns `null` if the input cannot be resolved.
 */
export function resolveLanguage(input: string | null | undefined): SupportedLanguage | null {
  if (!input) return null
  const lowered = input.trim().toLowerCase()
  if (!lowered) return null
  const aliased = LANGUAGE_ALIASES[lowered]
  if (aliased) return aliased
  return (PRELOADED_LANGUAGES as readonly string[]).includes(lowered)
    ? (lowered as SupportedLanguage)
    : null
}
