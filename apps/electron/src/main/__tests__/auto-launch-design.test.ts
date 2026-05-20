/**
 * TDD: auto-launch-design preferences (T537 Phase D)
 *
 * Tests for reading and writing `autoLaunchDesign` preference in
 * `userData/preferences.json`. Cycles 1-6.
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { mkdtempSync, writeFileSync, mkdirSync, existsSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Helper: create a fresh temp dir per test
let tempDir: string

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'rox-auto-launch-test-'))
})

afterEach(() => {
  if (tempDir && existsSync(tempDir)) {
    rmSync(tempDir, { recursive: true, force: true })
  }
})

// Dynamic import so we can pass tempDir as the userData path
async function importModule(userDataPath: string) {
  // Re-import with fresh module — use factory pattern
  const { createAutoLaunchDesignPrefs } = await import('../preferences/auto-launch-design')
  return createAutoLaunchDesignPrefs(userDataPath)
}

// ── Cycle 1 & 2: defaults to 'ask' when file missing ──────────────────────────

describe('readAutoLaunchDesignChoice', () => {
  it('returns "ask" when preferences file does not exist', async () => {
    const prefs = await importModule(tempDir)
    const choice = await prefs.readAutoLaunchDesignChoice()
    expect(choice).toBe('ask')
  })

  // ── Cycle 3 & 4: corrupt JSON returns 'ask' (fail-safe) ─────────────────────

  it('returns "ask" when preferences file contains corrupt JSON', async () => {
    const filePath = join(tempDir, 'preferences.json')
    writeFileSync(filePath, '{ "autoLaunchDesign": invalid json !!!')
    const prefs = await importModule(tempDir)
    const choice = await prefs.readAutoLaunchDesignChoice()
    expect(choice).toBe('ask')
  })

  it('returns "ask" when preferences file is empty', async () => {
    const filePath = join(tempDir, 'preferences.json')
    writeFileSync(filePath, '')
    const prefs = await importModule(tempDir)
    const choice = await prefs.readAutoLaunchDesignChoice()
    expect(choice).toBe('ask')
  })

  it('returns "ask" when autoLaunchDesign key is missing from valid JSON', async () => {
    const filePath = join(tempDir, 'preferences.json')
    writeFileSync(filePath, JSON.stringify({ name: 'Alice' }))
    const prefs = await importModule(tempDir)
    const choice = await prefs.readAutoLaunchDesignChoice()
    expect(choice).toBe('ask')
  })

  it('returns "ask" when autoLaunchDesign has an unrecognized value', async () => {
    const filePath = join(tempDir, 'preferences.json')
    writeFileSync(filePath, JSON.stringify({ autoLaunchDesign: 'unknown-value' }))
    const prefs = await importModule(tempDir)
    const choice = await prefs.readAutoLaunchDesignChoice()
    expect(choice).toBe('ask')
  })

  // ── Cycle 5 & 6: write 'always', read returns 'always' ──────────────────────

  it('reads back "always" after writing "always"', async () => {
    const prefs = await importModule(tempDir)
    await prefs.writeAutoLaunchDesignChoice('always')
    const choice = await prefs.readAutoLaunchDesignChoice()
    expect(choice).toBe('always')
  })

  it('reads back "never" after writing "never"', async () => {
    const prefs = await importModule(tempDir)
    await prefs.writeAutoLaunchDesignChoice('never')
    const choice = await prefs.readAutoLaunchDesignChoice()
    expect(choice).toBe('never')
  })

  it('reads back "ask" after writing "ask"', async () => {
    const prefs = await importModule(tempDir)
    await prefs.writeAutoLaunchDesignChoice('ask')
    const choice = await prefs.readAutoLaunchDesignChoice()
    expect(choice).toBe('ask')
  })

  it('preserves existing JSON fields when writing', async () => {
    const filePath = join(tempDir, 'preferences.json')
    writeFileSync(filePath, JSON.stringify({ name: 'Alice', updatedAt: 12345 }))
    const prefs = await importModule(tempDir)
    await prefs.writeAutoLaunchDesignChoice('always')

    const raw = JSON.parse(readFileSync(filePath, 'utf-8'))
    expect(raw.name).toBe('Alice')
    expect(raw.autoLaunchDesign).toBe('always')
  })

  it('uses atomic write (tmp + rename) — file appears complete after write', async () => {
    const prefs = await importModule(tempDir)
    await prefs.writeAutoLaunchDesignChoice('never')

    const filePath = join(tempDir, 'preferences.json')
    expect(existsSync(filePath)).toBe(true)

    // No partial .tmp file should remain
    const tmpFile = filePath + '.tmp'
    expect(existsSync(tmpFile)).toBe(false)
  })

  it('creates userData directory if it does not exist', async () => {
    const nestedDir = join(tempDir, 'nested', 'userData')
    const prefs = await importModule(nestedDir)
    await prefs.writeAutoLaunchDesignChoice('always')

    const filePath = join(nestedDir, 'preferences.json')
    expect(existsSync(filePath)).toBe(true)
  })
})
