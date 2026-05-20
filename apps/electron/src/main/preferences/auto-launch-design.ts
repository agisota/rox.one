/**
 * auto-launch-design.ts
 *
 * Read/write the `autoLaunchDesign` preference in `userData/preferences.json`.
 * Uses atomic file operations (write-to-.tmp + rename) to prevent corruption.
 *
 * Phase D / T537 PR #4
 */

import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'

export type AutoLaunchDesignChoice = 'always' | 'ask' | 'never'

const VALID_CHOICES: readonly AutoLaunchDesignChoice[] = ['always', 'ask', 'never']
const DEFAULT_CHOICE: AutoLaunchDesignChoice = 'ask'
const PREFS_FILENAME = 'preferences.json'

function isValidChoice(value: unknown): value is AutoLaunchDesignChoice {
  return typeof value === 'string' && (VALID_CHOICES as readonly string[]).includes(value)
}

function readJsonFile(filePath: string): Record<string, unknown> {
  try {
    const raw = readFileSync(filePath, 'utf-8').trim()
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
    return {}
  } catch {
    return {}
  }
}

export interface AutoLaunchDesignPrefs {
  readAutoLaunchDesignChoice(): Promise<AutoLaunchDesignChoice>
  writeAutoLaunchDesignChoice(choice: AutoLaunchDesignChoice): Promise<void>
}

/**
 * Factory that returns read/write helpers scoped to a given `userDataPath`.
 * In production use `app.getPath('userData')`. In tests pass a temp dir.
 */
export function createAutoLaunchDesignPrefs(userDataPath: string): AutoLaunchDesignPrefs {
  const filePath = join(userDataPath, PREFS_FILENAME)

  async function readAutoLaunchDesignChoice(): Promise<AutoLaunchDesignChoice> {
    if (!existsSync(filePath)) return DEFAULT_CHOICE
    const json = readJsonFile(filePath)
    const value = json['autoLaunchDesign']
    return isValidChoice(value) ? value : DEFAULT_CHOICE
  }

  async function writeAutoLaunchDesignChoice(choice: AutoLaunchDesignChoice): Promise<void> {
    // Ensure the directory exists (handles nested paths in tests)
    const dir = dirname(filePath)
    mkdirSync(dir, { recursive: true })

    // Read existing content to preserve other fields
    const existing = existsSync(filePath) ? readJsonFile(filePath) : {}
    const updated = { ...existing, autoLaunchDesign: choice, updatedAt: Date.now() }

    // Atomic write: .tmp → rename
    const tmpPath = filePath + '.tmp'
    writeFileSync(tmpPath, JSON.stringify(updated, null, 2), 'utf-8')
    renameSync(tmpPath, filePath)
  }

  return { readAutoLaunchDesignChoice, writeAutoLaunchDesignChoice }
}
