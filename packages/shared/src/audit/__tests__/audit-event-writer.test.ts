import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { getConfigDirForScope } from '../../config/storage-internal.ts'
import { deriveScopeFromAuth } from '../../config/storage-scope.ts'
import {
  __resetMultiTenantForTests,
  __setMultiTenantForTests,
} from '../../config/storage-scope-runtime.ts'
import { __setDebugEnabledForTests, enableDebug } from '../../utils/debug.ts'
import {
  __getAuditEventStoreForTests,
  __resetAuditEventWriterForTests,
  appendStructuredAuditEvent,
  flushAuditEventsForTests,
  verifyAuditHashChain,
} from '../index.ts'

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

describe('audit event writer fanout', () => {
  const previousConfigDir = process.env.ROX_CONFIG_DIR
  const previousAuditBackend = process.env.ROX_AUDIT_BACKEND
  let tempConfigDir: string | null = null

  beforeEach(() => {
    __resetMultiTenantForTests()
    __resetAuditEventWriterForTests()
    __setDebugEnabledForTests(false)
    tempConfigDir = mkdtempSync(join(tmpdir(), 'rox-audit-writer-'))
    process.env.ROX_CONFIG_DIR = tempConfigDir
  })

  afterEach(() => {
    __resetMultiTenantForTests()
    __resetAuditEventWriterForTests()
    if (previousConfigDir === undefined) delete process.env.ROX_CONFIG_DIR
    else process.env.ROX_CONFIG_DIR = previousConfigDir
    if (previousAuditBackend === undefined) delete process.env.ROX_AUDIT_BACKEND
    else process.env.ROX_AUDIT_BACKEND = previousAuditBackend
    if (tempConfigDir) {
      rmSync(tempConfigDir, { recursive: true, force: true })
      tempConfigDir = null
    }
  })

  it('keeps scope logger output and appends the same event to the memory backend', async () => {
    process.env.ROX_AUDIT_BACKEND = 'memory'
    enableDebug()
    const stderr = captureStderrWrites()

    try {
      deriveScopeFromAuth(
        { userId: 'user-1', permittedWorkspaces: [], reqId: 'req-1' },
        'tenant-a',
      )

      await flushAuditEventsForTests()
      const output = stderr.writes.join('')
      const records = await __getAuditEventStoreForTests()!.listRecords()

      expect(output).toContain('scope.factory.downgraded')
      expect(records).toHaveLength(1)
      expect(records[0]).toMatchObject({
        actor: { type: 'user', id: 'user-1' },
        tenantId: 'tenant-a',
        eventType: 'scope.factory.downgraded',
        severity: 'trace',
        requestId: 'req-1',
      })
      expect(records[0]!.payloadJson).toContain('multi-tenant-not-activated')
      expect(verifyAuditHashChain(records)).toBe(true)
    } finally {
      stderr.restore()
    }
  })

  it('persists scope audit events without requiring debug output', async () => {
    process.env.ROX_AUDIT_BACKEND = 'memory'
    __setMultiTenantForTests(true)

    expect(() => {
      getConfigDirForScope({ kind: 'workspace', workspaceId: 'tenant-a' } as any)
    }).toThrow('storage received an unbranded workspace scope')

    await flushAuditEventsForTests()
    const records = await __getAuditEventStoreForTests()!.listRecords()

    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({
      actor: { type: 'system' },
      tenantId: 'tenant-a',
      eventType: 'scope.brand.cast_breach',
      severity: 'error',
    })
  })

  it('writes redacted JSONL records under the config dir for the file backend', async () => {
    process.env.ROX_AUDIT_BACKEND = 'file'

    appendStructuredAuditEvent('trace', 'credential.scope.write', {
      workspaceId: 'tenant-a',
      reqId: 'req-credential',
      token: 'raw-token',
      nested: { apiKey: 'sk-live-secret0000', visible: 'safe' },
    })
    await flushAuditEventsForTests()

    const auditFile = join(tempConfigDir!, 'audit', 'events.jsonl')
    expect(existsSync(auditFile)).toBe(true)

    const line = readFileSync(auditFile, 'utf8').trim()
    expect(line).toContain('credential.scope.write')
    expect(line).toContain('tenant-a')
    expect(line).not.toContain('raw-token')
    expect(line).not.toContain('sk-live-secret0000')
    expect(line).toContain('[redacted]')
  })
})
