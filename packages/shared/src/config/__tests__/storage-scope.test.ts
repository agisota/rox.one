import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { enableDebug } from '../../utils/debug'
import { getConfigDir } from '../paths'
import { DEFAULT_LOCAL_SCOPE, deriveScopeFromAuth, type BrandedWorkspaceScope, workspaceIdFromScope } from '../storage-scope'
import { BrandedScopeBreachError, getConfigDirForScope } from '../storage-internal'
import {
  __resetMultiTenantForTests,
  __setMultiTenantForTests,
} from '../storage-scope-runtime'

function captureStderrWrites() {
  const writes: string[] = []
  const spy = spyOn(process.stderr, 'write').mockImplementation((chunk: string | Uint8Array) => {
    writes.push(String(chunk))
    return true
  })

  return {
    writes,
    restore: () => spy.mockRestore(),
  }
}

describe('WorkspaceScope', () => {
  const previousConfigDir = process.env.CRAFT_CONFIG_DIR
  let tempConfigDir: string | null = null

  beforeEach(() => {
    __resetMultiTenantForTests()
    tempConfigDir = mkdtempSync(join(tmpdir(), 'craft-storage-scope-'))
    process.env.CRAFT_CONFIG_DIR = tempConfigDir
  })

  afterEach(() => {
    __resetMultiTenantForTests()
    if (previousConfigDir === undefined) delete process.env.CRAFT_CONFIG_DIR
    else process.env.CRAFT_CONFIG_DIR = previousConfigDir
    if (tempConfigDir) {
      rmSync(tempConfigDir, { recursive: true, force: true })
      tempConfigDir = null
    }
  })

  it('DEFAULT_LOCAL_SCOPE is frozen so callers cannot mutate the singleton', () => {
    expect(Object.isFrozen(DEFAULT_LOCAL_SCOPE)).toBe(true)
  })

  it('DEFAULT_LOCAL_SCOPE satisfies BrandedWorkspaceScope', () => {
    const scope: BrandedWorkspaceScope = DEFAULT_LOCAL_SCOPE

    expect(scope.kind).toBe('local-single-user')
  })

  it('workspaceIdFromScope returns undefined for the local-single-user scope', () => {
    expect(workspaceIdFromScope(DEFAULT_LOCAL_SCOPE)).toBeUndefined()
  })

  it('workspaceIdFromScope returns workspaceId for a kind:workspace scope', () => {
    expect(workspaceIdFromScope({ kind: 'workspace', workspaceId: 'w1' })).toBe('w1')
  })

  it('resolves DEFAULT_LOCAL_SCOPE to the flat config dir', () => {
    expect(getConfigDirForScope(DEFAULT_LOCAL_SCOPE)).toBe(getConfigDir())
  })

  it('resolves branded workspace scope to tenant-prefixed dir when multi-tenant is active', () => {
    __setMultiTenantForTests(true)
    const scope = deriveScopeFromAuth(
      { userId: 'u1', permittedWorkspaces: ['W42'] },
      'W42',
    )

    expect(getConfigDirForScope(scope)).toBe(join(getConfigDir(), 'tenants', 'W42'))
  })

  it('downgrades branded workspace scope to flat config dir when multi-tenant is inactive', () => {
    __setMultiTenantForTests(true)
    const scope = deriveScopeFromAuth(
      { userId: 'u1', permittedWorkspaces: ['W42'] },
      'W42',
    )
    __setMultiTenantForTests(false)
    enableDebug()
    const stderr = captureStderrWrites()

    try {
      expect(getConfigDirForScope(scope)).toBe(getConfigDir())
      expect(stderr.writes.join('')).toContain('scope.runtime.workspace_downgraded')
    } finally {
      stderr.restore()
    }
  })

  it('throws and audits when an unbranded scope-shaped object reaches storage', () => {
    enableDebug()
    const stderr = captureStderrWrites()

    try {
      expect(() => {
        getConfigDirForScope({
          kind: 'workspace',
          workspaceId: 'W_FAKE',
        } as unknown as BrandedWorkspaceScope)
      }).toThrow(BrandedScopeBreachError)
      expect(stderr.writes.join('')).toContain('scope.brand.cast_breach')
    } finally {
      stderr.restore()
    }
  })
})
