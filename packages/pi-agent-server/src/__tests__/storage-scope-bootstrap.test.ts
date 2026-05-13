import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  MultiTenantForgeryError,
  deriveScopeFromAuth,
} from '../../../shared/src/config/storage-scope-auth.ts'
import { getConfigDirForScope } from '../../../shared/src/config/storage-internal.ts'
import {
  __resetMultiTenantForTests,
  __setMultiTenantForTests,
} from '../../../shared/src/config/storage-scope-runtime.ts'
import {
  PiStorageScopeIntegrityError,
  bootstrapScope,
} from '../storage-scope-bootstrap.ts'

describe('bootstrapScope', () => {
  const previousConfigDir = process.env.ROX_CONFIG_DIR
  const previousToken = process.env.ROX_PI_SCOPE_IPC_TOKEN
  let tempConfigDir: string | null = null

  beforeEach(() => {
    __resetMultiTenantForTests()
    __setMultiTenantForTests(true)
    tempConfigDir = mkdtempSync(join(tmpdir(), 'pi-scope-bootstrap-'))
    process.env.ROX_CONFIG_DIR = tempConfigDir
    process.env.ROX_PI_SCOPE_IPC_TOKEN = 'token-1'
  })

  afterEach(() => {
    __resetMultiTenantForTests()
    if (previousConfigDir === undefined) delete process.env.ROX_CONFIG_DIR
    else process.env.ROX_CONFIG_DIR = previousConfigDir
    if (previousToken === undefined) delete process.env.ROX_PI_SCOPE_IPC_TOKEN
    else process.env.ROX_PI_SCOPE_IPC_TOKEN = previousToken
    if (tempConfigDir) {
      rmSync(tempConfigDir, { recursive: true, force: true })
      tempConfigDir = null
    }
  })

  it('resolves a permitted tenant envelope to the parent-derived storage root', () => {
    const envelope = {
      requestedWorkspaceId: 'W42',
      permittedWorkspaces: ['W42'],
      userId: 'u1',
      reqId: 'session-1',
      integrityToken: 'token-1',
    }

    const parentScope = deriveScopeFromAuth(
      { userId: 'u1', permittedWorkspaces: ['W42'], reqId: 'session-1' },
      'W42',
    )
    const parentConfigDir = getConfigDirForScope(parentScope)

    const bootstrapped = bootstrapScope(envelope)

    expect(bootstrapped.scope.kind).toBe('workspace')
    expect(bootstrapped.workspaceId).toBe('W42')
    expect(bootstrapped.configDir).toBe(parentConfigDir)
    expect(bootstrapped.configDir).toBe(join(tempConfigDir!, 'tenants', 'W42'))
  })

  it('rejects a roxed requested workspace outside the permitted set', () => {
    expect(() => {
      bootstrapScope({
        requestedWorkspaceId: 'W_OTHER',
        permittedWorkspaces: ['W42'],
        userId: 'u1',
        reqId: 'session-1',
        integrityToken: 'token-1',
      })
    }).toThrow(MultiTenantForgeryError)
  })

  it('rejects a mismatched one-time integrity token before deriving scope', () => {
    expect(() => {
      bootstrapScope({
        requestedWorkspaceId: 'W42',
        permittedWorkspaces: ['W42'],
        userId: 'u1',
        reqId: 'session-1',
        integrityToken: 'wrong-token',
      })
    }).toThrow(PiStorageScopeIntegrityError)
  })
})
