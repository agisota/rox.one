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

  it('recognizes S02 prompt pipeline and documents current validation paths', async () => {
    const harness = await import('../e2e-smoke')
    const scenario = harness.resolveRequiredScenario('s02-prompt-pipeline')
    const ticket = readFileSync(join(rootDir, 'docs/tickets/T340-rc-s02-prompt-pipeline-flow.md'), 'utf8')

    expect(scenario.command).toContain('apps/electron/src/renderer/components/app-shell/input/__tests__/prompt-rewrite-flow.test.ts')
    expect(scenario.command).toContain('packages/shared/src/workbench/__tests__/review-board.test.ts')

    expect(ticket).not.toContain('apps/electron/src/renderer/components/composer/**/__tests__/**')
    expect(ticket).not.toContain('packages/server-core/src/handlers/rpc/__tests__/prompt*.test.ts')
    expect(ticket).not.toContain('packages/server-core/src/handlers/rpc/__tests__/spec*.test.ts')
  })

  it('recognizes S03 mission checkpoint and documents current validation paths', async () => {
    const harness = await import('../e2e-smoke')
    const scenario = harness.resolveRequiredScenario('s03-mission-checkpoint')
    const ticket = readFileSync(join(rootDir, 'docs/tickets/T341-rc-s03-mission-checkpoint-verification.md'), 'utf8')

    expect(scenario.command).toContain('packages/server-core/src/missions/__tests__/scheduler.test.ts')
    expect(scenario.command).toContain(
      'apps/electron/src/renderer/components/workbench/__tests__/mission-control-run-detail.test.tsx',
    )
    expect(scenario.command).toContain(
      'apps/electron/src/renderer/components/workbench/__tests__/deep-missions-screen.test.tsx',
    )

    expect(ticket).not.toContain('apps/electron/src/renderer/components/workbench/**/__tests__/mission*.test.*')
  })

  it('recognizes S04 arena swarm VDI and documents current validation paths', async () => {
    const harness = await import('../e2e-smoke')
    const scenario = harness.resolveRequiredScenario('s04-arena-swarm-vdi')
    const ticket = readFileSync(join(rootDir, 'docs/tickets/T342-rc-s04-arena-swarm-vdi-update.md'), 'utf8')

    expect(scenario.command).toContain('packages/shared/src/workbench/__tests__/swarm-signal-processor.test.ts')
    expect(scenario.command).toContain('packages/shared/src/workbench/__tests__/review-board.test.ts')
    expect(scenario.command).toContain(
      'apps/electron/src/renderer/components/workbench/__tests__/arena-builder-screen.test.tsx',
    )
    expect(scenario.command).toContain(
      'apps/electron/src/renderer/components/workbench/__tests__/experience-global-hud.test.tsx',
    )

    expect(ticket).not.toContain('packages/shared/src/agent/swarm/__tests__/**')
    expect(ticket).not.toContain('apps/electron/src/renderer/components/workbench/**/__tests__/vdi*.test.*')
  })
})
