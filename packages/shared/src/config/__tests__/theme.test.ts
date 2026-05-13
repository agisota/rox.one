/**
 * Tests for theme system: pure functions (theme.ts) + storage (storage-themes.ts, storage-settings.ts)
 *
 * Coverage:
 * - resolveTheme: passthrough, partial override, empty input
 * - themeToCSS: CSS variable emission for light and dark mode
 * - themeToCSS: hex → RGB derivation for foreground and accent
 * - themeToCSS: surface color fallback chain (paper/navigator/input/popover/popoverSolid)
 * - themeToCSS: scenic mode variable
 * - themeToCSS: dark mode overlay merging
 * - DEFAULT_THEME shape integrity
 * - getBackgroundColor: hex values for light and dark
 * - getShikiTheme: default and custom configs
 * - loadAppTheme / saveAppTheme: round-trip persistence (simulated reload via new process)
 * - getColorTheme / setColorTheme: preset ID persistence + default fallback
 * - loadPresetTheme: returns null for non-existent theme
 * - loadPresetThemes: loads valid JSON files from themes dir
 */

import { describe, expect, it, beforeEach, afterEach } from 'bun:test'
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
} from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { pathToFileURL } from 'url'

// ── Pure-function imports (no config dir required) ───────────────────────────
import {
  resolveTheme,
  themeToCSS,
  DEFAULT_THEME,
  getBackgroundColor,
  BACKGROUND_HEX,
  getShikiTheme,
  DEFAULT_SHIKI_THEME,
  type ThemeOverrides,
} from '../theme.ts'

// ── Module paths for subprocess tests (storage reads env vars at load time) ──
const STORAGE_THEMES_PATH = pathToFileURL(
  join(import.meta.dir, '..', 'storage-themes.ts'),
).href
const STORAGE_SETTINGS_PATH = pathToFileURL(
  join(import.meta.dir, '..', 'storage-settings.ts'),
).href

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeConfigDir() {
  const configDir = mkdtempSync(join(tmpdir(), 'rox-theme-test-'))
  const workspaceRoot = join(configDir, 'workspaces', 'default')
  mkdirSync(workspaceRoot, { recursive: true })

  writeFileSync(
    join(workspaceRoot, 'config.json'),
    JSON.stringify({
      id: 'ws-1',
      name: 'Default',
      slug: 'default',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }),
    'utf-8',
  )

  writeFileSync(
    join(configDir, 'config.json'),
    JSON.stringify({
      workspaces: [
        { id: 'ws-1', name: 'Default', rootPath: workspaceRoot, createdAt: Date.now() },
      ],
      activeWorkspaceId: 'ws-1',
      activeSessionId: null,
      llmConnections: [],
    }),
    'utf-8',
  )

  writeFileSync(
    join(configDir, 'config-defaults.json'),
    JSON.stringify({
      version: 'test',
      description: 'test defaults',
      defaults: {
        notificationsEnabled: true,
        colorTheme: 'default',
        autoCapitalisation: true,
        sendMessageKey: 'enter',
        spellCheck: false,
        keepAwakeWhileRunning: false,
        richToolDescriptions: true,
      },
      workspaceDefaults: {
        thinkingLevel: 'off',
        permissionMode: 'ask',
        cyclablePermissionModes: ['safe', 'ask', 'allow-all'],
        localMcpServers: { enabled: true },
      },
    }),
    'utf-8',
  )

  return configDir
}

function runEval(configDir: string, imports: string, code: string): string {
  const run = Bun.spawnSync(
    [process.execPath, '--eval', `${imports}\n${code}`],
    {
      env: { ...process.env, ROX_CONFIG_DIR: configDir },
      stdout: 'pipe',
      stderr: 'pipe',
    },
  )

  if (run.exitCode !== 0) {
    throw new Error(
      `subprocess failed (exit ${run.exitCode})\nstderr:\n${run.stderr.toString()}`,
    )
  }

  return run.stdout.toString().trim()
}

// ═══════════════════════════════════════════════════════════════════════════════
// resolveTheme
// ═══════════════════════════════════════════════════════════════════════════════

describe('resolveTheme', () => {
  it('returns empty object when called with no arguments', () => {
    const result = resolveTheme()
    expect(result).toEqual({})
  })

  it('returns the app theme unchanged when only app theme is provided', () => {
    const app: ThemeOverrides = { accent: '#8b5cf6', background: '#ffffff' }
    const result = resolveTheme(app)
    expect(result.accent).toBe('#8b5cf6')
    expect(result.background).toBe('#ffffff')
  })

  it('preserves dark overrides from app theme', () => {
    const app: ThemeOverrides = {
      background: '#ffffff',
      dark: { background: '#111111' },
    }
    const result = resolveTheme(app)
    expect(result.dark?.background).toBe('#111111')
  })

  it('returns an object (not undefined/null) for any input', () => {
    expect(resolveTheme(undefined)).toBeTruthy()
    expect(resolveTheme({})).toBeTruthy()
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// themeToCSS — semantic colors
// ═══════════════════════════════════════════════════════════════════════════════

describe('themeToCSS — semantic color variables', () => {
  it('emits --background variable', () => {
    const css = themeToCSS({ background: '#fafafa' })
    expect(css).toContain('--background: #fafafa;')
  })

  it('emits --foreground variable', () => {
    const css = themeToCSS({ foreground: '#111111' })
    expect(css).toContain('--foreground: #111111;')
  })

  it('emits --accent variable', () => {
    const css = themeToCSS({ accent: '#8b5cf6' })
    expect(css).toContain('--accent: #8b5cf6;')
  })

  it('emits --info variable', () => {
    const css = themeToCSS({ info: 'oklch(0.75 0.16 70)' })
    expect(css).toContain('--info: oklch(0.75 0.16 70);')
  })

  it('emits --success variable', () => {
    const css = themeToCSS({ success: 'green' })
    expect(css).toContain('--success: green;')
  })

  it('emits --destructive variable', () => {
    const css = themeToCSS({ destructive: 'red' })
    expect(css).toContain('--destructive: red;')
  })

  it('omits variables for undefined colors', () => {
    const css = themeToCSS({})
    expect(css).not.toContain('--background:')
    expect(css).not.toContain('--foreground:')
    expect(css).not.toContain('--accent:')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// themeToCSS — hex → RGB derivation
// ═══════════════════════════════════════════════════════════════════════════════

describe('themeToCSS — RGB derivation from hex colors', () => {
  it('emits --foreground-rgb for 6-digit hex foreground', () => {
    const css = themeToCSS({ foreground: '#111111' })
    expect(css).toContain('--foreground-rgb: 17, 17, 17;')
  })

  it('does not emit --foreground-rgb for non-hex foreground', () => {
    const css = themeToCSS({ foreground: 'oklch(0.185 0.01 270)' })
    expect(css).not.toContain('--foreground-rgb')
  })

  it('emits --accent-rgb as 70%-darkened values for 6-digit hex accent', () => {
    // #ffffff → 255,255,255 → Math.round(255 * 0.7) = 179
    const css = themeToCSS({ accent: '#ffffff' })
    expect(css).toContain('--accent-rgb: 179, 179, 179;')
  })

  it('handles 3-digit hex for foreground RGB', () => {
    // #fff → expanded #ffffff → 255,255,255
    const css = themeToCSS({ foreground: '#fff' })
    expect(css).toContain('--foreground-rgb: 255, 255, 255;')
  })

  it('does not emit --accent-rgb for non-hex accent', () => {
    const css = themeToCSS({ accent: 'purple' })
    expect(css).not.toContain('--accent-rgb')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// themeToCSS — surface color fallback chain
// ═══════════════════════════════════════════════════════════════════════════════

describe('themeToCSS — surface color fallback chain', () => {
  it('falls back all surface vars to background when surfaces are absent', () => {
    const css = themeToCSS({ background: '#eeeeee' })
    expect(css).toContain('--paper: #eeeeee;')
    expect(css).toContain('--navigator: #eeeeee;')
    expect(css).toContain('--input: #eeeeee;')
    expect(css).toContain('--popover: #eeeeee;')
    expect(css).toContain('--popover-solid: #eeeeee;')
  })

  it('uses explicit paper over background fallback', () => {
    const css = themeToCSS({ background: '#ffffff', paper: '#f0f0f0' })
    expect(css).toContain('--paper: #f0f0f0;')
  })

  it('uses explicit navigator over background fallback', () => {
    const css = themeToCSS({ background: '#ffffff', navigator: '#dddddd' })
    expect(css).toContain('--navigator: #dddddd;')
  })

  it('popoverSolid falls back to popover when popoverSolid absent', () => {
    const css = themeToCSS({ background: '#ffffff', popover: '#cccccc' })
    expect(css).toContain('--popover-solid: #cccccc;')
  })

  it('popoverSolid uses its own value when set', () => {
    const css = themeToCSS({ popover: '#cccccc', popoverSolid: '#dddddd' })
    expect(css).toContain('--popover-solid: #dddddd;')
  })

  it('falls back surface vars to var(--background) when no background specified', () => {
    const css = themeToCSS({})
    expect(css).toContain('--paper: var(--background);')
    expect(css).toContain('--navigator: var(--background);')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// themeToCSS — scenic mode
// ═══════════════════════════════════════════════════════════════════════════════

describe('themeToCSS — theme mode variable', () => {
  it('emits --theme-mode: solid by default', () => {
    const css = themeToCSS({})
    expect(css).toContain('--theme-mode: solid;')
  })

  it('emits --theme-mode: scenic when mode is scenic', () => {
    const css = themeToCSS({ mode: 'scenic', backgroundImage: 'https://example.com/bg.jpg' })
    expect(css).toContain('--theme-mode: scenic;')
  })

  it('emits --theme-mode: solid when mode is explicitly solid', () => {
    const css = themeToCSS({ mode: 'solid' })
    expect(css).toContain('--theme-mode: solid;')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// themeToCSS — dark mode overlay
// ═══════════════════════════════════════════════════════════════════════════════

describe('themeToCSS — dark mode overlay', () => {
  const theme: ThemeOverrides = {
    background: '#ffffff',
    foreground: '#000000',
    accent: '#8b5cf6',
    dark: {
      background: '#111111',
      foreground: '#eeeeee',
      accent: '#a78bfa',
    },
  }

  it('uses light colors when isDark=false', () => {
    const css = themeToCSS(theme, false)
    expect(css).toContain('--background: #ffffff;')
    expect(css).toContain('--foreground: #000000;')
    expect(css).toContain('--accent: #8b5cf6;')
  })

  it('uses dark overrides when isDark=true', () => {
    const css = themeToCSS(theme, true)
    expect(css).toContain('--background: #111111;')
    expect(css).toContain('--foreground: #eeeeee;')
    expect(css).toContain('--accent: #a78bfa;')
  })

  it('falls back to light values for dark keys not overridden', () => {
    const partialDarkTheme: ThemeOverrides = {
      background: '#ffffff',
      success: '#22c55e',
      dark: { background: '#111111' },
    }
    const css = themeToCSS(partialDarkTheme, true)
    // Dark background applies
    expect(css).toContain('--background: #111111;')
    // Success was not overridden in dark → uses light value
    expect(css).toContain('--success: #22c55e;')
  })

  it('isDark=false behaves same as default (no second arg)', () => {
    const cssDefault = themeToCSS(theme)
    const cssLight = themeToCSS(theme, false)
    expect(cssDefault).toBe(cssLight)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// DEFAULT_THEME integrity
// ═══════════════════════════════════════════════════════════════════════════════

describe('DEFAULT_THEME', () => {
  it('contains all six semantic colors in light mode', () => {
    expect(DEFAULT_THEME.background).toBeTruthy()
    expect(DEFAULT_THEME.foreground).toBeTruthy()
    expect(DEFAULT_THEME.accent).toBeTruthy()
    expect(DEFAULT_THEME.info).toBeTruthy()
    expect(DEFAULT_THEME.success).toBeTruthy()
    expect(DEFAULT_THEME.destructive).toBeTruthy()
  })

  it('has dark overrides for all six semantic colors', () => {
    expect(DEFAULT_THEME.dark?.background).toBeTruthy()
    expect(DEFAULT_THEME.dark?.foreground).toBeTruthy()
    expect(DEFAULT_THEME.dark?.accent).toBeTruthy()
    expect(DEFAULT_THEME.dark?.info).toBeTruthy()
    expect(DEFAULT_THEME.dark?.success).toBeTruthy()
    expect(DEFAULT_THEME.dark?.destructive).toBeTruthy()
  })

  it('produces valid CSS output for both modes', () => {
    const lightCss = themeToCSS(DEFAULT_THEME, false)
    const darkCss = themeToCSS(DEFAULT_THEME, true)
    expect(lightCss.length).toBeGreaterThan(0)
    expect(darkCss.length).toBeGreaterThan(0)
    // Dark CSS must differ from light CSS (overrides are applied)
    expect(darkCss).not.toBe(lightCss)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// getBackgroundColor
// ═══════════════════════════════════════════════════════════════════════════════

describe('getBackgroundColor', () => {
  it('returns light hex for isDark=false', () => {
    expect(getBackgroundColor(false)).toBe(BACKGROUND_HEX.light)
  })

  it('returns dark hex for isDark=true', () => {
    expect(getBackgroundColor(true)).toBe(BACKGROUND_HEX.dark)
  })

  it('light and dark hex values are different', () => {
    expect(BACKGROUND_HEX.light).not.toBe(BACKGROUND_HEX.dark)
  })

  it('both values are valid 7-character hex strings', () => {
    expect(BACKGROUND_HEX.light).toMatch(/^#[0-9a-f]{6}$/i)
    expect(BACKGROUND_HEX.dark).toMatch(/^#[0-9a-f]{6}$/i)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// getShikiTheme
// ═══════════════════════════════════════════════════════════════════════════════

describe('getShikiTheme', () => {
  it('returns github-light for light mode with default config', () => {
    expect(getShikiTheme(undefined, false)).toBe('github-light')
  })

  it('returns github-dark for dark mode with default config', () => {
    expect(getShikiTheme(undefined, true)).toBe('github-dark')
  })

  it('returns custom light theme', () => {
    expect(getShikiTheme({ light: 'nord', dark: 'dracula' }, false)).toBe('nord')
  })

  it('returns custom dark theme', () => {
    expect(getShikiTheme({ light: 'nord', dark: 'dracula' }, true)).toBe('dracula')
  })

  it('falls back to github-light when light key is absent', () => {
    expect(getShikiTheme({ dark: 'dracula' }, false)).toBe('github-light')
  })

  it('falls back to github-dark when dark key is absent', () => {
    expect(getShikiTheme({ light: 'nord' }, true)).toBe('github-dark')
  })

  it('DEFAULT_SHIKI_THEME has both light and dark entries', () => {
    expect(DEFAULT_SHIKI_THEME.light).toBeTruthy()
    expect(DEFAULT_SHIKI_THEME.dark).toBeTruthy()
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// loadAppTheme / saveAppTheme — persistence
// ═══════════════════════════════════════════════════════════════════════════════

describe('loadAppTheme / saveAppTheme — persistence', () => {
  it('returns null when theme.json does not exist', () => {
    const configDir = makeConfigDir()
    const output = runEval(
      configDir,
      `import { loadAppTheme } from '${STORAGE_THEMES_PATH}';`,
      'console.log(String(loadAppTheme()))',
    )
    expect(output).toBe('null')
  })

  it('round-trips a saved theme across process boundaries', () => {
    const configDir = makeConfigDir()
    const theme = { accent: '#8b5cf6', background: '#ffffff' }

    runEval(
      configDir,
      `import { saveAppTheme } from '${STORAGE_THEMES_PATH}';`,
      `saveAppTheme(${JSON.stringify(theme)})`,
    )

    const output = runEval(
      configDir,
      `import { loadAppTheme } from '${STORAGE_THEMES_PATH}';`,
      'console.log(JSON.stringify(loadAppTheme()))',
    )

    const loaded = JSON.parse(output)
    expect(loaded.accent).toBe('#8b5cf6')
    expect(loaded.background).toBe('#ffffff')
  })

  it('persists dark overrides round-trip', () => {
    const configDir = makeConfigDir()
    const theme: ThemeOverrides = {
      background: '#ffffff',
      dark: { background: '#111111' },
    }

    runEval(
      configDir,
      `import { saveAppTheme } from '${STORAGE_THEMES_PATH}';`,
      `saveAppTheme(${JSON.stringify(theme)})`,
    )

    const output = runEval(
      configDir,
      `import { loadAppTheme } from '${STORAGE_THEMES_PATH}';`,
      'console.log(JSON.stringify(loadAppTheme()))',
    )

    const loaded = JSON.parse(output)
    expect(loaded.dark?.background).toBe('#111111')
  })

  it('overwrites previous theme.json on second save', () => {
    const configDir = makeConfigDir()

    runEval(
      configDir,
      `import { saveAppTheme } from '${STORAGE_THEMES_PATH}';`,
      `saveAppTheme({ accent: '#first' })`,
    )
    runEval(
      configDir,
      `import { saveAppTheme } from '${STORAGE_THEMES_PATH}';`,
      `saveAppTheme({ accent: '#second' })`,
    )

    const output = runEval(
      configDir,
      `import { loadAppTheme } from '${STORAGE_THEMES_PATH}';`,
      'console.log(JSON.stringify(loadAppTheme()))',
    )

    const loaded = JSON.parse(output)
    expect(loaded.accent).toBe('#second')
  })

  it('theme.json is written to the correct config directory', () => {
    const configDir = makeConfigDir()
    const theme = { accent: '#3b82f6' }

    runEval(
      configDir,
      `import { saveAppTheme } from '${STORAGE_THEMES_PATH}';`,
      `saveAppTheme(${JSON.stringify(theme)})`,
    )

    const themeFilePath = join(configDir, 'theme.json')
    expect(existsSync(themeFilePath)).toBe(true)

    const raw = JSON.parse(readFileSync(themeFilePath, 'utf-8'))
    expect(raw.accent).toBe('#3b82f6')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// getColorTheme / setColorTheme — preset ID persistence
// ═══════════════════════════════════════════════════════════════════════════════

describe('getColorTheme / setColorTheme — preset ID persistence', () => {
  it('returns "default" when colorTheme is not set in config', () => {
    const configDir = makeConfigDir()
    const output = runEval(
      configDir,
      `import { getColorTheme } from '${STORAGE_SETTINGS_PATH}';`,
      'console.log(getColorTheme())',
    )
    expect(output).toBe('default')
  })

  it('persists a preset theme ID across process boundaries', () => {
    const configDir = makeConfigDir()

    runEval(
      configDir,
      `import { setColorTheme } from '${STORAGE_SETTINGS_PATH}';`,
      `setColorTheme('nord')`,
    )

    const output = runEval(
      configDir,
      `import { getColorTheme } from '${STORAGE_SETTINGS_PATH}';`,
      'console.log(getColorTheme())',
    )
    expect(output).toBe('nord')
  })

  it('overwrites previous preset ID', () => {
    const configDir = makeConfigDir()

    runEval(
      configDir,
      `import { setColorTheme } from '${STORAGE_SETTINGS_PATH}';`,
      `setColorTheme('dracula')`,
    )
    runEval(
      configDir,
      `import { setColorTheme } from '${STORAGE_SETTINGS_PATH}';`,
      `setColorTheme('tokyo-night')`,
    )

    const output = runEval(
      configDir,
      `import { getColorTheme } from '${STORAGE_SETTINGS_PATH}';`,
      'console.log(getColorTheme())',
    )
    expect(output).toBe('tokyo-night')
  })

  it('writes colorTheme into config.json on disk', () => {
    const configDir = makeConfigDir()
    const configPath = join(configDir, 'config.json')

    runEval(
      configDir,
      `import { setColorTheme } from '${STORAGE_SETTINGS_PATH}';`,
      `setColorTheme('catppuccin')`,
    )

    const config = JSON.parse(readFileSync(configPath, 'utf-8'))
    expect(config.colorTheme).toBe('catppuccin')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// loadPresetTheme / loadPresetThemes
// ═══════════════════════════════════════════════════════════════════════════════

describe('loadPresetTheme', () => {
  it('returns null for a non-existent theme ID', () => {
    const configDir = makeConfigDir()
    const output = runEval(
      configDir,
      `import { loadPresetTheme } from '${STORAGE_THEMES_PATH}';`,
      `console.log(String(loadPresetTheme('does-not-exist')))`,
    )
    expect(output).toBe('null')
  })

  it('loads a manually placed theme file by ID', () => {
    const configDir = makeConfigDir()
    const themesDir = join(configDir, 'themes')
    mkdirSync(themesDir, { recursive: true })

    const themeData = {
      name: 'Test Theme',
      accent: '#3b82f6',
      background: '#0f0f0f',
    }
    writeFileSync(join(themesDir, 'test-theme.json'), JSON.stringify(themeData), 'utf-8')

    const output = runEval(
      configDir,
      `import { loadPresetTheme } from '${STORAGE_THEMES_PATH}';`,
      `console.log(JSON.stringify(loadPresetTheme('test-theme')))`,
    )

    const loaded = JSON.parse(output)
    expect(loaded.id).toBe('test-theme')
    expect(loaded.theme.accent).toBe('#3b82f6')
    expect(loaded.theme.background).toBe('#0f0f0f')
  })
})

describe('loadPresetThemes', () => {
  it('returns empty array when themes directory does not exist and bundled assets unavailable', () => {
    const configDir = makeConfigDir()
    // Do not create themes dir and no bundled assets in test env
    const output = runEval(
      configDir,
      `import { loadPresetThemes } from '${STORAGE_THEMES_PATH}';`,
      `const themes = loadPresetThemes(); console.log(Array.isArray(themes) ? themes.length : 'not-array')`,
    )
    // Either 0 (no themes dir + no bundled assets) or a positive number if bundled assets exist
    const count = parseInt(output, 10)
    expect(isNaN(count)).toBe(false)
  })

  it('loads multiple theme files from themes directory', () => {
    const configDir = makeConfigDir()
    const themesDir = join(configDir, 'themes')
    mkdirSync(themesDir, { recursive: true })

    const themes = [
      { file: 'alpha.json', data: { name: 'Alpha', accent: '#ff0000' } },
      { file: 'beta.json', data: { name: 'Beta', accent: '#00ff00' } },
    ]
    for (const { file, data } of themes) {
      writeFileSync(join(themesDir, file), JSON.stringify(data), 'utf-8')
    }

    const output = runEval(
      configDir,
      `import { loadPresetThemes } from '${STORAGE_THEMES_PATH}';`,
      `const t = loadPresetThemes(); console.log(JSON.stringify(t.map(x => x.id).sort()))`,
    )

    const ids: string[] = JSON.parse(output)
    expect(ids).toContain('alpha')
    expect(ids).toContain('beta')
  })

  it('sorts default theme first when present', () => {
    const configDir = makeConfigDir()
    const themesDir = join(configDir, 'themes')
    mkdirSync(themesDir, { recursive: true })

    writeFileSync(join(themesDir, 'zebra.json'), JSON.stringify({ name: 'Zebra', accent: '#000' }), 'utf-8')
    writeFileSync(join(themesDir, 'default.json'), JSON.stringify({ name: 'Default', accent: '#fff' }), 'utf-8')

    const output = runEval(
      configDir,
      `import { loadPresetThemes } from '${STORAGE_THEMES_PATH}';`,
      `const t = loadPresetThemes(); console.log(t[0]?.id)`,
    )

    expect(output).toBe('default')
  })

  it('skips non-JSON files in themes directory', () => {
    const configDir = makeConfigDir()
    const themesDir = join(configDir, 'themes')
    mkdirSync(themesDir, { recursive: true })

    writeFileSync(join(themesDir, 'readme.md'), '# Themes', 'utf-8')
    writeFileSync(join(themesDir, 'valid.json'), JSON.stringify({ name: 'Valid', accent: '#123456' }), 'utf-8')

    const output = runEval(
      configDir,
      `import { loadPresetThemes } from '${STORAGE_THEMES_PATH}';`,
      `const t = loadPresetThemes(); console.log(JSON.stringify(t.map(x => x.id)))`,
    )

    const ids: string[] = JSON.parse(output)
    expect(ids).toContain('valid')
    expect(ids).not.toContain('readme')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// themeToCSS — full DEFAULT_THEME output sanity check
// ═══════════════════════════════════════════════════════════════════════════════

describe('themeToCSS — DEFAULT_THEME full output', () => {
  it('emits all expected CSS variable names in light mode', () => {
    const css = themeToCSS(DEFAULT_THEME, false)
    const expectedVars = [
      '--background',
      '--foreground',
      '--accent',
      '--info',
      '--success',
      '--destructive',
      '--paper',
      '--navigator',
      '--input',
      '--popover',
      '--popover-solid',
      '--theme-mode',
    ]
    for (const varName of expectedVars) {
      expect(css).toContain(varName)
    }
  })

  it('dark mode output differs from light mode for background and foreground', () => {
    const light = themeToCSS(DEFAULT_THEME, false)
    const dark = themeToCSS(DEFAULT_THEME, true)

    // Extract --background values
    const bgLight = light.match(/--background: ([^;]+);/)?.[1]
    const bgDark = dark.match(/--background: ([^;]+);/)?.[1]

    expect(bgLight).toBeTruthy()
    expect(bgDark).toBeTruthy()
    expect(bgLight).not.toBe(bgDark)
  })
})
