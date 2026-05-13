import {
  migrateMultiTenantData,
  rollbackMultiTenantDataMigration,
  type MultiTenantMigrationMode,
} from '../packages/shared/src/config/storage-multi-tenant-migration.ts'
import { getConfigDir } from '../packages/shared/src/config/paths.ts'

interface ParsedArgs {
  tenant?: string
  rollback?: string
  from?: string
  to?: string
  mode?: MultiTenantMigrationMode
  configDir?: string
}

function usage(): string {
  return [
    'Usage:',
    '  bun run migrate:multi-tenant -- --tenant <id> --from flat --to tenant-prefixed --dry-run',
    '  bun run migrate:multi-tenant -- --tenant <id> --from flat --to tenant-prefixed --apply',
    '  bun run migrate:multi-tenant -- --rollback <tenant>',
  ].join('\n')
}

function parseArgs(argv: string[]): ParsedArgs {
  const parsed: ParsedArgs = {}

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    switch (arg) {
      case '--tenant':
        parsed.tenant = requireValue(argv, index, arg)
        index += 1
        break
      case '--rollback':
        parsed.rollback = requireValue(argv, index, arg)
        index += 1
        break
      case '--from':
        parsed.from = requireValue(argv, index, arg)
        index += 1
        break
      case '--to':
        parsed.to = requireValue(argv, index, arg)
        index += 1
        break
      case '--config-dir':
        parsed.configDir = requireValue(argv, index, arg)
        index += 1
        break
      case '--dry-run':
        parsed.mode = 'dry-run'
        break
      case '--apply':
        parsed.mode = 'apply'
        break
      default:
        throw new Error(`Unknown argument: ${arg}`)
    }
  }

  return parsed
}

function requireValue(argv: string[], index: number, arg: string): string {
  const value = argv[index + 1]
  if (!value || value.startsWith('--')) {
    throw new Error(`${arg} requires a value`)
  }
  return value
}

function main(): void {
  const parsed = parseArgs(process.argv.slice(2))
  const configDir = parsed.configDir ?? getConfigDir()

  if (parsed.rollback) {
    console.log(JSON.stringify(rollbackMultiTenantDataMigration({
      configDir,
      tenantId: parsed.rollback,
    }), null, 2))
    return
  }

  if (!parsed.tenant || parsed.from !== 'flat' || parsed.to !== 'tenant-prefixed' || !parsed.mode) {
    throw new Error(usage())
  }

  console.log(JSON.stringify(migrateMultiTenantData({
    configDir,
    tenantId: parsed.tenant,
    from: 'flat',
    to: 'tenant-prefixed',
    mode: parsed.mode,
  }), null, 2))
}

try {
  main()
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}
