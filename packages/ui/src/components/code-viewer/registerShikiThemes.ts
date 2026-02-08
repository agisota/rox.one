import { registerCustomTheme, resolveTheme } from '@pierre/diffs'

const GLOBAL_THEME_KEY = '__roxShikiThemesRegistered__'

/**
 * Register rox-dark / rox-light Shiki themes once per runtime.
 * Prevents duplicate registration warnings during HMR or StrictMode re-mounts.
 */
export function registerRoxShikiThemes() {
  if (typeof globalThis === 'undefined') return
  const globalRef = globalThis as typeof globalThis & { [GLOBAL_THEME_KEY]?: boolean }
  if (globalRef[GLOBAL_THEME_KEY]) return
  globalRef[GLOBAL_THEME_KEY] = true

  registerCustomTheme('rox-dark', async () => {
    const theme = await resolveTheme('pierre-dark')
    return { ...theme, name: 'rox-dark', bg: 'transparent', colors: { ...theme.colors, 'editor.background': 'transparent' } }
  })

  registerCustomTheme('rox-light', async () => {
    const theme = await resolveTheme('pierre-light')
    return { ...theme, name: 'rox-light', bg: 'transparent', colors: { ...theme.colors, 'editor.background': 'transparent' } }
  })
}
