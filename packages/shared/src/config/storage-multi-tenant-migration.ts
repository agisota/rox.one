import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  statfsSync,
  writeFileSync,
} from 'node:fs'
import { createHash } from 'node:crypto'
import { basename, dirname, join, relative } from 'node:path'

import { getConfigDir } from './paths.ts'

export type MultiTenantMigrationFileClass =
  | 'config'
  | 'credentials'
  | 'drafts'
  | 'themes'
  | 'workspaces'
  | 'conversations'
  | 'llm-connections'
  | 'tool-icons'

export type MultiTenantMigrationMode = 'dry-run' | 'apply'
export type MultiTenantMigrationSource = 'flat'
export type MultiTenantMigrationTarget = 'tenant-prefixed'
export type MultiTenantMigrationAction = 'copy' | 'skip-existing' | 'conflict'
export type MultiTenantMigrationStatus = 'planned' | 'applied' | 'noop'

export interface MultiTenantMigrationOptions {
  configDir?: string
  tenantId: string
  from: MultiTenantMigrationSource
  to: MultiTenantMigrationTarget
  mode: MultiTenantMigrationMode
}

export interface MultiTenantRollbackOptions {
  configDir?: string
  tenantId: string
}

export interface MultiTenantMigrationFile {
  relativePath: string
  sourcePath: string
  destinationPath: string
  classes: MultiTenantMigrationFileClass[]
  action: MultiTenantMigrationAction
  sizeBytes: number
  sourceSha256: string
  destinationSha256?: string
  verified: boolean
}

export interface MultiTenantMigrationResult {
  status: MultiTenantMigrationStatus
  tenantId: string
  configDir: string
  tenantDir: string
  snapshotDir?: string
  files: MultiTenantMigrationFile[]
  copiedCount: number
  skippedCount: number
  conflictCount: number
  totalBytes: number
}

export interface MultiTenantRollbackResult {
  status: 'rolled-back'
  tenantId: string
  configDir: string
  snapshotDir: string
}

interface NormalizedMigrationOptions extends Required<MultiTenantMigrationOptions> {
  tenantDir: string
}

interface NormalizedRollbackOptions extends Required<MultiTenantRollbackOptions> {}

const SNAPSHOT_ROOT_SUFFIX = '.migration-snapshots'
const LOCK_FILE_SUFFIX = '.multi-tenant-migration.lock'

export function migrateMultiTenantData(options: MultiTenantMigrationOptions): MultiTenantMigrationResult {
  const normalized = normalizeMigrationOptions(options)

  if (normalized.mode === 'dry-run') {
    const files = collectMigrationFiles(normalized.configDir, normalized.tenantDir)
    assertNoConflicts(files)
    return buildMigrationResult('planned', normalized, files)
  }

  return withMigrationLock(normalized.configDir, () => {
    const files = collectMigrationFiles(normalized.configDir, normalized.tenantDir)
    assertNoConflicts(files)

    if (!files.some(file => file.action === 'copy')) {
      return buildMigrationResult('noop', normalized, files)
    }

    assertFreeDiskForMigration(normalized.configDir, files)
    const snapshotDir = createMigrationSnapshot(normalized.configDir, normalized.tenantId)
    const copiedFiles = copyMigrationFiles(files)
    writeLatestSnapshot(normalized.configDir, normalized.tenantId, snapshotDir)
    return buildMigrationResult('applied', normalized, copiedFiles, snapshotDir)
  })
}

export function rollbackMultiTenantDataMigration(options: MultiTenantRollbackOptions): MultiTenantRollbackResult {
  const normalized = normalizeRollbackOptions(options)
  const snapshotDir = findLatestSnapshot(normalized.configDir, normalized.tenantId)
  const flatSnapshotDir = join(snapshotDir, 'flat')
  if (!existsSync(flatSnapshotDir)) {
    throw new Error(`Migration snapshot is missing flat config root: ${flatSnapshotDir}`)
  }

  return withMigrationLock(normalized.configDir, () => {
    rmSync(normalized.configDir, { recursive: true, force: true })
    cpSync(flatSnapshotDir, normalized.configDir, { recursive: true, preserveTimestamps: true })
    return {
      status: 'rolled-back',
      tenantId: normalized.tenantId,
      configDir: normalized.configDir,
      snapshotDir,
    }
  })
}

function normalizeMigrationOptions(options: MultiTenantMigrationOptions): NormalizedMigrationOptions {
  if (options.from !== 'flat') {
    throw new Error(`Unsupported migration source: ${options.from}`)
  }
  if (options.to !== 'tenant-prefixed') {
    throw new Error(`Unsupported migration target: ${options.to}`)
  }
  if (options.mode !== 'dry-run' && options.mode !== 'apply') {
    throw new Error(`Unsupported migration mode: ${options.mode}`)
  }

  const configDir = options.configDir ?? getConfigDir()
  const tenantId = normalizeTenantId(options.tenantId)
  return {
    configDir,
    tenantId,
    from: options.from,
    to: options.to,
    mode: options.mode,
    tenantDir: join(configDir, 'tenants', tenantId),
  }
}

function normalizeRollbackOptions(options: MultiTenantRollbackOptions): NormalizedRollbackOptions {
  return {
    configDir: options.configDir ?? getConfigDir(),
    tenantId: normalizeTenantId(options.tenantId),
  }
}

function normalizeTenantId(tenantId: string): string {
  const normalized = tenantId.trim()
  if (!/^[A-Za-z0-9._-]+$/.test(normalized)) {
    throw new Error('Tenant id must contain only letters, numbers, dots, underscores, or hyphens')
  }
  return normalized
}

function collectMigrationFiles(configDir: string, tenantDir: string): MultiTenantMigrationFile[] {
  if (!existsSync(configDir)) {
    throw new Error(`Config directory does not exist: ${configDir}`)
  }

  const relativePaths = [
    'config.json',
    'config-defaults.json',
    'credentials.enc',
    'drafts.json',
    'theme.json',
    ...listFilesUnder(join(configDir, 'themes')).map(path => relative(configDir, path)),
    ...listFilesUnder(join(configDir, 'tool-icons')).map(path => relative(configDir, path)),
    ...listFilesUnder(join(configDir, 'workspaces')).map(path => relative(configDir, path)),
  ]
    .filter((path, index, paths) => path.length > 0 && paths.indexOf(path) === index)
    .sort()

  return relativePaths
    .map(relativePath => buildMigrationFile(configDir, tenantDir, relativePath))
    .filter((file): file is MultiTenantMigrationFile => file !== null)
}

function buildMigrationFile(configDir: string, tenantDir: string, relativePath: string): MultiTenantMigrationFile | null {
  const sourcePath = join(configDir, relativePath)
  if (!existsSync(sourcePath) || !statSync(sourcePath).isFile()) {
    return null
  }

  const destinationPath = join(tenantDir, relativePath)
  const sourceSha256 = sha256File(sourcePath)
  const sizeBytes = statSync(sourcePath).size
  const destinationSha256 = existsSync(destinationPath) && statSync(destinationPath).isFile()
    ? sha256File(destinationPath)
    : undefined
  const action = destinationSha256 == null
    ? 'copy'
    : destinationSha256 === sourceSha256 ? 'skip-existing' : 'conflict'

  return {
    relativePath,
    sourcePath,
    destinationPath,
    classes: classifyRelativePath(relativePath),
    action,
    sizeBytes,
    sourceSha256,
    ...(destinationSha256 ? { destinationSha256 } : {}),
    verified: action === 'skip-existing',
  }
}

function classifyRelativePath(relativePath: string): MultiTenantMigrationFileClass[] {
  if (relativePath === 'config.json') return ['config', 'llm-connections']
  if (relativePath === 'config-defaults.json') return ['config']
  if (relativePath === 'credentials.enc') return ['credentials']
  if (relativePath === 'drafts.json') return ['drafts']
  if (relativePath === 'theme.json' || relativePath.startsWith('themes/')) return ['themes']
  if (relativePath.startsWith('tool-icons/')) return ['tool-icons']
  if (relativePath.startsWith('workspaces/')) {
    const filename = basename(relativePath)
    if (filename === 'conversation.json' || filename === 'plan.json') return ['conversations']
    return ['workspaces']
  }
  return ['config']
}

function listFilesUnder(dir: string): string[] {
  if (!existsSync(dir)) return []
  const entries = readdirSync(dir, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))
  const files: string[] = []

  for (const entry of entries) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...listFilesUnder(path))
    } else if (entry.isFile()) {
      files.push(path)
    }
  }

  return files
}

function assertNoConflicts(files: MultiTenantMigrationFile[]): void {
  const conflicts = files.filter(file => file.action === 'conflict')
  if (conflicts.length > 0) {
    throw new Error(`Tenant destination has conflicting files: ${conflicts.map(file => file.relativePath).join(', ')}`)
  }
}

function assertFreeDiskForMigration(configDir: string, files: MultiTenantMigrationFile[]): void {
  const requiredBytes = files
    .filter(file => file.action === 'copy')
    .reduce((total, file) => total + file.sizeBytes, 0) * 2
  const probeDir = existsSync(configDir) ? configDir : dirname(configDir)
  const stats = statfsSync(probeDir)
  const availableBytes = stats.bavail * stats.bsize
  if (availableBytes < requiredBytes) {
    throw new Error(`Insufficient free disk for multi-tenant migration: need ${requiredBytes}, available ${availableBytes}`)
  }
}

function createMigrationSnapshot(configDir: string, tenantId: string): string {
  const snapshotDir = join(getTenantSnapshotRoot(configDir, tenantId), new Date().toISOString().replace(/[:.]/g, '-'))
  const flatSnapshotDir = join(snapshotDir, 'flat')
  mkdirSync(snapshotDir, { recursive: true })
  cpSync(configDir, flatSnapshotDir, { recursive: true, preserveTimestamps: true, errorOnExist: true })
  return snapshotDir
}

function copyMigrationFiles(files: MultiTenantMigrationFile[]): MultiTenantMigrationFile[] {
  return files.map(file => {
    if (file.action !== 'copy') return file

    mkdirSync(dirname(file.destinationPath), { recursive: true })
    copyFileSync(file.sourcePath, file.destinationPath)
    const destinationSha256 = sha256File(file.destinationPath)
    if (destinationSha256 !== file.sourceSha256) {
      throw new Error(`Checksum mismatch after copying ${file.relativePath}`)
    }

    return {
      ...file,
      destinationSha256,
      verified: true,
    }
  })
}

function buildMigrationResult(
  status: MultiTenantMigrationStatus,
  options: NormalizedMigrationOptions,
  files: MultiTenantMigrationFile[],
  snapshotDir?: string,
): MultiTenantMigrationResult {
  return {
    status,
    tenantId: options.tenantId,
    configDir: options.configDir,
    tenantDir: options.tenantDir,
    ...(snapshotDir ? { snapshotDir } : {}),
    files,
    copiedCount: status === 'applied' ? files.filter(file => file.action === 'copy').length : 0,
    skippedCount: files.filter(file => file.action === 'skip-existing').length,
    conflictCount: files.filter(file => file.action === 'conflict').length,
    totalBytes: files.reduce((total, file) => total + file.sizeBytes, 0),
  }
}

function getTenantSnapshotRoot(configDir: string, tenantId: string): string {
  return join(`${configDir}${SNAPSHOT_ROOT_SUFFIX}`, tenantId)
}

function writeLatestSnapshot(configDir: string, tenantId: string, snapshotDir: string): void {
  const snapshotRoot = getTenantSnapshotRoot(configDir, tenantId)
  mkdirSync(snapshotRoot, { recursive: true })
  writeFileSync(
    join(snapshotRoot, 'latest.json'),
    `${JSON.stringify({ snapshotDir, createdAt: new Date().toISOString() }, null, 2)}\n`,
    'utf-8',
  )
}

function findLatestSnapshot(configDir: string, tenantId: string): string {
  const snapshotRoot = getTenantSnapshotRoot(configDir, tenantId)
  const latestPath = join(snapshotRoot, 'latest.json')
  if (existsSync(latestPath)) {
    const latest = JSON.parse(readFileSync(latestPath, 'utf-8')) as { snapshotDir?: string }
    if (latest.snapshotDir && existsSync(latest.snapshotDir)) return latest.snapshotDir
  }

  if (!existsSync(snapshotRoot)) {
    throw new Error(`No migration snapshots found for tenant ${tenantId}`)
  }

  const snapshots = readdirSync(snapshotRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => join(snapshotRoot, entry.name))
    .sort()

  const snapshotDir = snapshots.at(-1)
  if (!snapshotDir) {
    throw new Error(`No migration snapshots found for tenant ${tenantId}`)
  }
  return snapshotDir
}

function withMigrationLock<T>(configDir: string, operation: () => T): T {
  const lockPath = `${configDir}${LOCK_FILE_SUFFIX}`
  try {
    writeFileSync(lockPath, `${JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() })}\n`, {
      encoding: 'utf-8',
      flag: 'wx',
    })
  } catch (error) {
    throw new Error(`Multi-tenant migration lock is already held at ${lockPath}: ${error instanceof Error ? error.message : String(error)}`)
  }

  try {
    return operation()
  } finally {
    rmSync(lockPath, { force: true })
  }
}

function sha256File(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}
