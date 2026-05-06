import { describe, expect, it } from 'bun:test'
import { existsSync, mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { pathToFileURL } from 'url'
import { inferModelSelectionMode, shouldMigratePiOpenAiProvider, shouldRepairPiApiKeyCodexProvider } from '../storage'

import { loadConfigDefaults, ensureConfigDir } from '../storage'


const STORAGE_MODULE_PATH = pathToFileURL(join(import.meta.dir, '..', 'storage.ts')).href

function runLoadConfigDefaults(configDir: string): { exitCode: number; stdout: string; stderr: string } {
  const run = Bun.spawnSync([
    process.execPath,
    '--eval',
    `import { loadConfigDefaults } from '${STORAGE_MODULE_PATH}'; const defaults = loadConfigDefaults(); console.log(JSON.stringify(defaults));`,
  ], {
    env: { ...process.env, CRAFT_CONFIG_DIR: configDir },
    stdout: 'pipe',
    stderr: 'pipe',
  })

  return {
    exitCode: run.exitCode,
    stdout: run.stdout.toString().trim(),
    stderr: run.stderr.toString(),
  }
}


describe('ensureConfigDir', () => {
  it('initializes a newly overridden CRAFT_CONFIG_DIR within the same process', () => {
    const originalConfigDir = process.env.CRAFT_CONFIG_DIR
    const firstDir = mkdtempSync(join(tmpdir(), 'config-dir-first-'))
    const secondDir = mkdtempSync(join(tmpdir(), 'config-dir-second-'))

    try {
      process.env.CRAFT_CONFIG_DIR = firstDir
      ensureConfigDir()
      expect(existsSync(join(firstDir, 'config-defaults.json'))).toBe(true)

      process.env.CRAFT_CONFIG_DIR = secondDir
      ensureConfigDir()
      expect(existsSync(join(secondDir, 'config-defaults.json'))).toBe(true)
      const defaults = loadConfigDefaults()
      expect(defaults.workspaceDefaults.permissionMode).toBeString()
    } finally {
      if (originalConfigDir === undefined) delete process.env.CRAFT_CONFIG_DIR
      else process.env.CRAFT_CONFIG_DIR = originalConfigDir
      rmSync(firstDir, { recursive: true, force: true })
      rmSync(secondDir, { recursive: true, force: true })
    }
  })
})

describe('loadConfigDefaults', () => {
  it('bootstraps fallback config-defaults when none exist yet', () => {
    const configDir = mkdtempSync(join(tmpdir(), 'config-defaults-test-'))

    try {
      const run = runLoadConfigDefaults(configDir)
      expect(run.exitCode).toBe(0)
      const defaults = JSON.parse(run.stdout)
      expect(defaults.workspaceDefaults.permissionMode).toBeString()
      expect(defaults.workspaceDefaults.cyclablePermissionModes.length).toBeGreaterThanOrEqual(2)
      expect(existsSync(join(configDir, 'config-defaults.json'))).toBe(true)
    } finally {
      rmSync(configDir, { recursive: true, force: true })
    }
  })
})

describe('shouldMigratePiOpenAiProvider', () => {
  it('migrates legacy Pi OAuth OpenAI connections to openai-codex', () => {
    expect(shouldMigratePiOpenAiProvider({
      providerType: 'pi',
      piAuthProvider: 'openai',
      authType: 'oauth',
    })).toBe(true)
  })

  it('does not migrate Pi API key OpenAI connections', () => {
    expect(shouldMigratePiOpenAiProvider({
      providerType: 'pi',
      piAuthProvider: 'openai',
      authType: 'api_key',
    })).toBe(false)
  })

  it('does not migrate Pi custom endpoint connections', () => {
    expect(shouldMigratePiOpenAiProvider({
      providerType: 'pi',
      piAuthProvider: 'openai',
      authType: 'oauth',
      baseUrl: 'https://custom.gateway.example/v1',
    })).toBe(false)
  })

  it('does not migrate already-correct openai-codex connections', () => {
    expect(shouldMigratePiOpenAiProvider({
      providerType: 'pi',
      piAuthProvider: 'openai-codex',
      authType: 'oauth',
    })).toBe(false)
  })
})

describe('shouldRepairPiApiKeyCodexProvider', () => {
  it('repairs Pi API key connections that were incorrectly set to openai-codex', () => {
    expect(shouldRepairPiApiKeyCodexProvider({
      providerType: 'pi',
      piAuthProvider: 'openai-codex',
      authType: 'api_key',
    })).toBe(true)
  })

  it('repairs Pi API key with endpoint connections that were incorrectly set to openai-codex', () => {
    expect(shouldRepairPiApiKeyCodexProvider({
      providerType: 'pi',
      piAuthProvider: 'openai-codex',
      authType: 'api_key_with_endpoint',
    })).toBe(true)
  })

  it('does not repair OAuth openai-codex connections', () => {
    expect(shouldRepairPiApiKeyCodexProvider({
      providerType: 'pi',
      piAuthProvider: 'openai-codex',
      authType: 'oauth',
    })).toBe(false)
  })

  it('does not repair non-OpenAI-Codex providers', () => {
    expect(shouldRepairPiApiKeyCodexProvider({
      providerType: 'pi',
      piAuthProvider: 'openai',
      authType: 'api_key',
    })).toBe(false)
  })
})

describe('inferModelSelectionMode', () => {
  it('infers automaticallySyncedFromProvider when model list equals provider defaults', () => {
    const providerDefaults = ['pi/zai-best', 'pi/zai-balanced', 'pi/zai-fast']
    const mode = inferModelSelectionMode({ models: [...providerDefaults] }, providerDefaults)
    expect(mode).toBe('automaticallySyncedFromProvider')
  })

  it('infers userDefined3Tier when model list is a custom subset', () => {
    const providerDefaults = ['pi/zai-best', 'pi/zai-balanced', 'pi/zai-fast', 'pi/zai-extra']
    const mode = inferModelSelectionMode({ models: ['pi/zai-best', 'pi/zai-fast', 'pi/zai-extra'] }, providerDefaults)
    expect(mode).toBe('userDefined3Tier')
  })

  it('infers automaticallySyncedFromProvider for empty model lists', () => {
    const providerDefaults = ['pi/zai-best', 'pi/zai-balanced', 'pi/zai-fast']
    const mode = inferModelSelectionMode({ models: [] }, providerDefaults)
    expect(mode).toBe('automaticallySyncedFromProvider')
  })
})
