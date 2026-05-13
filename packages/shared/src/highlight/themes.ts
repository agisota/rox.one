/**
 * Curated set of preloaded Shiki themes.
 *
 * Each entry maps to a theme JSON bundled at build time. The set covers the
 * 15 user-pickable presets in `apps/electron/resources/themes/`.
 *
 * See ADR 0010 for the rationale.
 */

export const PRELOADED_THEMES = [
  'github-light',
  'github-dark',
  'catppuccin-latte',
  'catppuccin-mocha',
  'dracula',
  'vitesse-dark',
  'vitesse-light',
  'night-owl',
  'nord',
  'one-dark-pro',
  'one-light',
  'rose-pine',
  'rose-pine-dawn',
  'solarized-light',
  'solarized-dark',
  'tokyo-night',
] as const

export type SupportedTheme = (typeof PRELOADED_THEMES)[number]

export const DEFAULT_LIGHT_THEME: SupportedTheme = 'github-light'
export const DEFAULT_DARK_THEME: SupportedTheme = 'github-dark'

/**
 * Map a caller-supplied theme name to a supported theme, falling back to the
 * appropriate github default when the input is unknown or absent.
 */
export function resolveTheme(input: string | null | undefined, isDark: boolean): SupportedTheme {
  const fallback = isDark ? DEFAULT_DARK_THEME : DEFAULT_LIGHT_THEME
  if (!input) return fallback
  return (PRELOADED_THEMES as readonly string[]).includes(input) ? (input as SupportedTheme) : fallback
}
