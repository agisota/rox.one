import { describe, expect, test } from 'bun:test'
import { existsSync, readdirSync, readFileSync } from 'fs'
import { join } from 'path'

import { PRELOADED_THEMES } from '../../highlight/themes.ts'
import { validateThemeContent } from '../validators.ts'

const THEME_DIR = join(process.cwd(), 'apps/electron/resources/themes')

const ZED_INSPIRED_THEME_IDS = [
  'kanagawa-wave',
  'macos-classic',
  'snazzy',
  'vscode-dark-modern',
] as const

function readTheme(file: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(THEME_DIR, file), 'utf-8'))
}

describe('bundled theme presets', () => {
  test('includes the curated Zed-inspired theme presets', () => {
    for (const id of ZED_INSPIRED_THEME_IDS) {
      expect(existsSync(join(THEME_DIR, `${id}.json`))).toBe(true)
    }
  })

  test('all bundled theme files validate', () => {
    const files = readdirSync(THEME_DIR).filter(file => file.endsWith('.json'))
    expect(files.length).toBeGreaterThanOrEqual(19)

    for (const file of files) {
      const content = readFileSync(join(THEME_DIR, file), 'utf-8')
      const result = validateThemeContent(content, file)
      expect(result.valid, `${file}: ${result.errors.map(error => error.message).join(', ')}`).toBe(true)
    }
  })

  test('all bundled shiki theme references are preloaded', () => {
    const preloaded = new Set<string>(PRELOADED_THEMES)
    const files = readdirSync(THEME_DIR).filter(file => file.endsWith('.json'))

    for (const file of files) {
      const theme = readTheme(file)
      const shikiTheme = theme.shikiTheme as { light?: string; dark?: string } | undefined
      for (const value of [shikiTheme?.light, shikiTheme?.dark]) {
        if (value) {
          expect(preloaded.has(value), `${file} references unloaded Shiki theme ${value}`).toBe(true)
        }
      }
    }
  })
})
