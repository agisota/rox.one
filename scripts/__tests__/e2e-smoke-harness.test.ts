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

  it('recognizes S05 team invite RBAC and documents current validation paths', async () => {
    const harness = await import('../e2e-smoke')
    const scenario = harness.resolveRequiredScenario('s05-team-invite-rbac')
    const ticket = readFileSync(join(rootDir, 'docs/tickets/T343-rc-s05-team-invite-rbac.md'), 'utf8')

    expect(scenario.command).toContain('packages/server-core/src/handlers/rpc/__tests__/roles.test.ts')
    expect(scenario.command).toContain('packages/shared/src/auth/__tests__/policy-engine.test.ts')
    expect(scenario.command).toContain('packages/shared/src/auth/__tests__/scope-forgery.property.test.ts')
    expect(scenario.command).toContain('packages/server-core/src/webui/__tests__/account-teams.test.ts')
    expect(scenario.command).toContain(
      'apps/electron/src/renderer/components/settings/rbac/__tests__/team-management-state.test.ts',
    )

    expect(ticket).toContain('bun run e2e:smoke -- --scenario s05-team-invite-rbac')
  })

  it('recognizes S06 file upload entity graph and documents current validation paths', async () => {
    const harness = await import('../e2e-smoke')
    const scenario = harness.resolveRequiredScenario('s06-file-upload-entity-graph')
    const ticket = readFileSync(join(rootDir, 'docs/tickets/T344-rc-s06-file-upload-entity-graph.md'), 'utf8')

    expect(scenario.command).toContain('packages/server-core/src/handlers/rpc/files.test.ts')
    expect(scenario.command).toContain('packages/shared/src/workbench/__tests__/markdown-entity-graph.test.ts')
    expect(scenario.command).toContain('packages/server-core/src/handlers/__tests__/file-manager-scopes.test.ts')
    expect(scenario.command).toContain(
      'apps/electron/src/renderer/components/right-sidebar/__tests__/session-files-watch.test.ts',
    )

    expect(ticket).not.toContain('apps/electron/src/renderer/components/workbench/**/__tests__/file*.test.*')
    expect(ticket).not.toContain('packages/shared/src/**/__tests__/entity-graph*.test.ts')
  })

  it('recognizes S07 sync conflict resolution and documents current validation paths', async () => {
    const harness = await import('../e2e-smoke')
    const scenario = harness.resolveRequiredScenario('s07-sync-conflict-resolution')
    const ticket = readFileSync(join(rootDir, 'docs/tickets/T345-rc-s07-sync-conflict-resolution.md'), 'utf8')

    expect(scenario.command).toContain('packages/server-core/src/sync/__tests__/local-cloud-sync.test.ts')
    expect(scenario.command).toContain('packages/server-core/src/sync/__tests__/workspace-sync-service.test.ts')
    expect(scenario.command).toContain(
      'packages/server-core/src/sync/__tests__/workspace-sync-multi-client-conflict.test.ts',
    )

    expect(ticket).not.toContain('packages/server-core/src/**/__tests__/sync*.test.ts')
  })

  it('recognizes S08 share session shortlink and documents current validation paths', async () => {
    const harness = await import('../e2e-smoke')
    const scenario = harness.resolveRequiredScenario('s08-share-session-shortlink')
    const ticket = readFileSync(join(rootDir, 'docs/tickets/T346-rc-s08-share-session-shortlink.md'), 'utf8')

    expect(scenario.command).toContain('packages/server-core/src/sessions/session-share-provider.test.ts')
    expect(scenario.command).toContain('packages/server-core/src/sessions/share-provider.test.ts')
    expect(scenario.command).toContain('packages/server-core/src/sessions/share-errors.test.ts')
    expect(scenario.command).toContain(
      'apps/electron/src/renderer/components/app-shell/__tests__/session-share-flow.test.ts',
    )

    expect(ticket).not.toContain('packages/server-core/src/**/__tests__/shortlink*.test.ts')
    expect(ticket).not.toContain('packages/shared/src/**/__tests__/share*.test.ts')
    expect(ticket).not.toContain('packages/shared/src/**/__tests__/share-payload-secret*.test.ts')
  })
})
