import { afterEach, describe, expect, it } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import {
  migrateMultiTenantData,
  rollbackMultiTenantDataMigration,
  type MultiTenantMigrationFileClass,
} from '../storage-multi-tenant-migration'

const REQUIRED_CLASSES: MultiTenantMigrationFileClass[] = [
  'config',
  'credentials',
  'drafts',
  'themes',
  'workspaces',
  'conversations',
  'llm-connections',
  'tool-icons',
]

function writeFile(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content, 'utf-8')
}

function setupFlatConfigFixture(): string {
  const configDir = mkdtempSync(join(tmpdir(), 'rox-mt-migration-'))
  writeFile(
    join(configDir, 'config.json'),
    JSON.stringify({
      workspaces: [{ id: 'ws-1', name: 'One', rootPath: '/tmp/ws-1', createdAt: 1 }],
      activeWorkspaceId: 'ws-1',
      activeSessionId: null,
      llmConnections: [{ slug: 'pi', providerType: 'pi', authType: 'oauth' }],
    }, null, 2),
  )
  writeFile(join(configDir, 'config-defaults.json'), '{"version":"1.0"}')
  writeFile(join(configDir, 'credentials.enc'), 'encrypted credentials')
  writeFile(join(configDir, 'drafts.json'), '{"sessions":{"s1":{"text":"draft"}}}')
  writeFile(join(configDir, 'theme.json'), '{"theme":"custom"}')
  writeFile(join(configDir, 'themes', 'custom.json'), '{"name":"Custom"}')
  writeFile(join(configDir, 'tool-icons', 'bash.svg'), '<svg />')
  writeFile(join(configDir, 'workspaces', 'ws-1', 'config.json'), '{"id":"ws-1"}')
  writeFile(join(configDir, 'workspaces', 'ws-1', 'conversation.json'), '{"messages":[]}')
  writeFile(join(configDir, 'workspaces', 'ws-1', 'plan.json'), '{"steps":[]}')
  return configDir
}

function read(path: string): string {
  return readFileSync(path, 'utf-8')
}

describe('multi-tenant data migration tooling', () => {
  const tempDirs: string[] = []
  const previousConfigDir = process.env.CRAFT_CONFIG_DIR

  afterEach(() => {
    if (previousConfigDir === undefined) delete process.env.CRAFT_CONFIG_DIR
    else process.env.CRAFT_CONFIG_DIR = previousConfigDir
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true })
      rmSync(`${dir}.migration-snapshots`, { recursive: true, force: true })
      rmSync(`${dir}.multi-tenant-migration.lock`, { force: true })
    }
  })

  it('plans a dry-run without creating tenant data', () => {
    const configDir = setupFlatConfigFixture()
    tempDirs.push(configDir)

    const result = migrateMultiTenantData({
      configDir,
      tenantId: 'tenant-a',
      from: 'flat',
      to: 'tenant-prefixed',
      mode: 'dry-run',
    })

    expect(result.status).toBe('planned')
    expect(result.copiedCount).toBe(0)
    expect(result.files.filter(file => file.action === 'copy').length).toBeGreaterThan(0)
    expect(new Set(result.files.flatMap(file => file.classes))).toEqual(new Set(REQUIRED_CLASSES))
    expect(result.files.map(file => file.relativePath)).toEqual([...result.files.map(file => file.relativePath)].sort())
    expect(existsSync(join(configDir, 'tenants', 'tenant-a'))).toBe(false)
  })

  it('applies with a snapshot, checksum verification, source preservation, and idempotent rerun', () => {
    const configDir = setupFlatConfigFixture()
    tempDirs.push(configDir)

    const first = migrateMultiTenantData({
      configDir,
      tenantId: 'tenant-a',
      from: 'flat',
      to: 'tenant-prefixed',
      mode: 'apply',
    })

    expect(first.status).toBe('applied')
    expect(first.snapshotDir).toBeString()
    expect(first.copiedCount).toBeGreaterThan(0)
    expect(first.files.every(file => file.action !== 'copy' || file.verified)).toBe(true)
    expect(first.files.every(file => file.action !== 'copy' || file.sourceSha256 === file.destinationSha256)).toBe(true)
    expect(read(join(configDir, 'credentials.enc'))).toBe('encrypted credentials')
    expect(read(join(configDir, 'tenants', 'tenant-a', 'credentials.enc'))).toBe('encrypted credentials')
    expect(read(join(configDir, 'tenants', 'tenant-a', 'workspaces', 'ws-1', 'conversation.json'))).toBe('{"messages":[]}')
    expect(existsSync(join(first.snapshotDir!, 'flat', 'config.json'))).toBe(true)

    const second = migrateMultiTenantData({
      configDir,
      tenantId: 'tenant-a',
      from: 'flat',
      to: 'tenant-prefixed',
      mode: 'apply',
    })

    expect(second.status).toBe('noop')
    expect(second.snapshotDir).toBeUndefined()
    expect(second.copiedCount).toBe(0)
    expect(second.files.every(file => file.action === 'skip-existing')).toBe(true)
  })

  it('rolls back from the recorded snapshot', () => {
    const configDir = setupFlatConfigFixture()
    tempDirs.push(configDir)

    migrateMultiTenantData({
      configDir,
      tenantId: 'tenant-a',
      from: 'flat',
      to: 'tenant-prefixed',
      mode: 'apply',
    })
    writeFile(join(configDir, 'after-migration.json'), '{"new":true}')
    writeFile(join(configDir, 'tenants', 'tenant-a', 'credentials.enc'), 'mutated tenant data')

    const rollback = rollbackMultiTenantDataMigration({ configDir, tenantId: 'tenant-a' })

    expect(rollback.status).toBe('rolled-back')
    expect(read(join(configDir, 'credentials.enc'))).toBe('encrypted credentials')
    expect(existsSync(join(configDir, 'after-migration.json'))).toBe(false)
    expect(existsSync(join(configDir, 'tenants', 'tenant-a'))).toBe(false)
  })

  it('runs through the root CLI entrypoint', () => {
    const configDir = setupFlatConfigFixture()
    tempDirs.push(configDir)
    process.env.CRAFT_CONFIG_DIR = configDir

    const run = Bun.spawnSync([
      process.execPath,
      'run',
      'migrate:multi-tenant',
      '--',
      '--tenant',
      'tenant-a',
      '--from',
      'flat',
      '--to',
      'tenant-prefixed',
      '--dry-run',
    ], {
      cwd: join(import.meta.dir, '..', '..', '..', '..', '..'),
      env: { ...process.env, CRAFT_CONFIG_DIR: configDir },
      stdout: 'pipe',
      stderr: 'pipe',
    })

    expect(run.exitCode).toBe(0)
    const result = JSON.parse(run.stdout.toString())
    expect(result.status).toBe('planned')
    expect(result.tenantId).toBe('tenant-a')
    expect(existsSync(join(configDir, 'tenants', 'tenant-a'))).toBe(false)
  })
})
