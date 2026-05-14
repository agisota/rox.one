import { describe, expect, it } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const rootDir = join(import.meta.dir, '..', '..')

const PROTECTED_ROX_PATHS = [
  'apps/electron/src/renderer/components/workbench/',
  'apps/electron/src/renderer/pages/settings/',
  'apps/electron/src/main/account-api.ts',
  'packages/shared/src/workbench/',
  'packages/shared/src/i18n/',
  'packages/server-core/src/webui/',
  'packages/server-core/src/sync/',
  'docs/tickets/',
  'docs/worklog/',
  'docs/release/',
  '.swarm/',
] as const

function readProtectedSurfaceSection(): string {
  const plan = readFileSync(join(rootDir, 'plan.md'), 'utf8')
  const section = plan.match(/### 6\.2 Protected ROX-Owned Surfaces(?<section>[\s\S]*?)### 6\.3 Merge Data Flow/)
  return section?.groups?.section ?? ''
}

describe('protected ROX-owned path map', () => {
  it('keeps plan.md §6.2 anchored to the current protected path list', () => {
    const section = readProtectedSurfaceSection()

    expect(section).toContain('These areas need explicit owner review during merge:')
    for (const protectedPath of PROTECTED_ROX_PATHS) {
      expect(section).toContain(protectedPath)
    }
  })

  it('keeps every protected ROX-owned path present in the worktree', () => {
    for (const protectedPath of PROTECTED_ROX_PATHS) {
      expect(existsSync(join(rootDir, protectedPath))).toBeTrue()
    }
  })
})
