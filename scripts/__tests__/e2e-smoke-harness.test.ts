import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const rootDir = join(import.meta.dir, '..', '..')

describe('RC E2E smoke harness', () => {
  it('exposes the root e2e:smoke package script', () => {
    const packageJson = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf8'))

    expect(packageJson.scripts['e2e:smoke']).toBe('bun run scripts/e2e-smoke.ts')
  })

  it('recognizes S01 registration and reports supported scenarios for unknown ids', async () => {
    const harness = await import('../e2e-smoke')

    expect(harness.SUPPORTED_SCENARIOS.map((scenario) => scenario.id)).toContain('s01-registration')
    expect(harness.resolveScenario('s01-registration')?.command).toEqual([
      'bun',
      'run',
      'electron:ui-smoke:packaged:mac',
    ])

    expect(() => harness.resolveRequiredScenario('missing-scenario')).toThrow(
      /Unsupported scenario "missing-scenario".*s01-registration/s,
    )
  })
})
