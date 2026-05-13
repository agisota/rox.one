#!/usr/bin/env bun
import { spawn } from 'bun'
import { join } from 'node:path'

const ROOT_DIR = join(import.meta.dir, '..')

export interface SmokeScenario {
  id: string
  title: string
  command: string[]
  requiredPlatform?: NodeJS.Platform
}

const S02_PROMPT_PIPELINE_TESTS = [
  'apps/electron/src/renderer/components/app-shell/input/__tests__/prompt-rewrite-flow.test.ts',
  'apps/electron/src/renderer/components/app-shell/input/__tests__/composer-artifact-flow.test.ts',
  'apps/electron/src/renderer/components/app-shell/input/__tests__/composer-artifact-panel.test.tsx',
  'apps/electron/src/renderer/components/workbench/__tests__/spec-builder-screen.test.tsx',
  'apps/electron/src/renderer/components/workbench/__tests__/artifact-screens.test.tsx',
  'packages/shared/src/workbench/__tests__/prompt-rewrite-engine.test.ts',
  'packages/shared/src/workbench/__tests__/spec-compiler.test.ts',
  'packages/shared/src/workbench/__tests__/tdd-task-generator.test.ts',
  'packages/shared/src/workbench/__tests__/review-board.test.ts',
] as const

const S03_MISSION_CHECKPOINT_TESTS = [
  'packages/server-core/src/missions/__tests__/mission-id.test.ts',
  'packages/server-core/src/missions/__tests__/mission-store.test.ts',
  'packages/server-core/src/missions/__tests__/scheduler.test.ts',
  'packages/server-core/src/missions/__tests__/state.test.ts',
  'packages/server-core/src/missions/__tests__/transitions.test.ts',
  'packages/server-core/src/missions/__tests__/scheduler-audit.test.ts',
  'packages/server-core/src/missions/__tests__/sqlite-mission-store.test.ts',
  'packages/server-core/src/missions/__tests__/host.test.ts',
  'apps/electron/src/renderer/components/workbench/__tests__/deep-missions-screen.test.tsx',
  'apps/electron/src/renderer/components/workbench/__tests__/mission-control-run-detail.test.tsx',
  'apps/electron/src/renderer/components/workbench/__tests__/workbench-interactions.test.ts',
  'apps/electron/src/renderer/components/workbench/__tests__/experience-real-state-binding.test.tsx',
] as const

const S04_ARENA_SWARM_VDI_TESTS = [
  'packages/shared/src/workbench/__tests__/swarm-signal-processor.test.ts',
  'packages/shared/src/workbench/__tests__/review-board.test.ts',
  'packages/shared/src/workbench/__tests__/experience-layer-e2e-scenario.test.ts',
  'packages/shared/src/workbench/__tests__/experience-runtime-store.test.ts',
  'packages/shared/src/workbench/__tests__/experience-state-binding.test.ts',
  'apps/electron/src/renderer/components/workbench/__tests__/arena-builder-screen.test.tsx',
  'apps/electron/src/renderer/components/workbench/__tests__/progression-observatory.test.tsx',
  'apps/electron/src/renderer/components/workbench/__tests__/experience-global-hud.test.tsx',
  'apps/electron/src/renderer/components/workbench/__tests__/experience-real-state-binding.test.tsx',
] as const

const S05_TEAM_INVITE_RBAC_TESTS = [
  'packages/server-core/src/handlers/rpc/__tests__/roles.test.ts',
  'packages/server-core/src/handlers/rpc/__tests__/roles-audit.test.ts',
  'packages/server-core/src/handlers/rpc/__tests__/roles-rate-limit.test.ts',
  'packages/shared/src/auth/__tests__/policy-engine.test.ts',
  'packages/shared/src/auth/__tests__/policy-engine.edge-cases.test.ts',
  'packages/shared/src/auth/__tests__/scope-forgery.property.test.ts',
  'packages/server-core/src/webui/__tests__/account-teams.test.ts',
  'packages/server-core/src/webui/__tests__/account-http.test.ts',
  'packages/server-core/src/webui/__tests__/team-chat-http.test.ts',
  'apps/electron/src/renderer/components/settings/rbac/__tests__/team-management-state.test.ts',
  'apps/electron/src/renderer/components/settings/rbac/__tests__/roles-panel-state.test.ts',
  'apps/electron/src/renderer/components/settings/rbac/__tests__/roles-panel.test.tsx',
] as const

const S06_FILE_UPLOAD_ENTITY_GRAPH_TESTS = [
  'packages/shared/src/workbench/__tests__/markdown-entity-graph.test.ts',
  'packages/server-core/src/handlers/rpc/files.test.ts',
  'packages/server-core/src/handlers/__tests__/file-manager-scopes.test.ts',
  'packages/server-core/src/handlers/__tests__/validate-file-path.test.ts',
  'apps/electron/src/renderer/lib/__tests__/file-changes.test.ts',
  'apps/electron/src/renderer/components/right-sidebar/__tests__/session-files-watch.test.ts',
] as const

export const SUPPORTED_SCENARIOS: SmokeScenario[] = [
  {
    id: 's01-registration',
    title: 'RC S01 registration and persisted login smoke',
    command: ['bun', 'run', 'electron:ui-smoke:packaged:mac'],
    requiredPlatform: 'darwin',
  },
  {
    id: 's02-prompt-pipeline',
    title: 'RC S02 prompt rewrite to review pipeline smoke',
    command: ['bun', 'test', ...S02_PROMPT_PIPELINE_TESTS],
  },
  {
    id: 's03-mission-checkpoint',
    title: 'RC S03 mission checkpoint and final verification smoke',
    command: ['bun', 'test', ...S03_MISSION_CHECKPOINT_TESTS],
  },
  {
    id: 's04-arena-swarm-vdi',
    title: 'RC S04 arena swarm signal dedupe and VDI smoke',
    command: ['bun', 'test', ...S04_ARENA_SWARM_VDI_TESTS],
  },
  {
    id: 's05-team-invite-rbac',
    title: 'RC S05 team invite and RBAC smoke',
    command: ['bun', 'test', ...S05_TEAM_INVITE_RBAC_TESTS],
  },
  {
    id: 's06-file-upload-entity-graph',
    title: 'RC S06 file upload entity graph smoke',
    command: ['bun', 'test', ...S06_FILE_UPLOAD_ENTITY_GRAPH_TESTS],
  },
]

export function resolveScenario(id: string): SmokeScenario | undefined {
  return SUPPORTED_SCENARIOS.find((scenario) => scenario.id === id)
}

export function supportedScenariosMessage(): string {
  return SUPPORTED_SCENARIOS.map((scenario) => scenario.id).join(', ')
}

export function resolveRequiredScenario(id: string): SmokeScenario {
  const scenario = resolveScenario(id)
  if (!scenario) {
    throw new Error(`Unsupported scenario "${id}". Supported scenarios: ${supportedScenariosMessage()}`)
  }
  return scenario
}

export function parseScenarioArg(argv: string[]): string {
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--scenario') {
      const value = argv[index + 1]
      if (!value) {
        throw new Error(`Missing value for --scenario. Supported scenarios: ${supportedScenariosMessage()}`)
      }
      return value
    }
    if (arg.startsWith('--scenario=')) {
      const value = arg.slice('--scenario='.length)
      if (!value) {
        throw new Error(`Missing value for --scenario. Supported scenarios: ${supportedScenariosMessage()}`)
      }
      return value
    }
  }

  throw new Error(`Missing required --scenario. Supported scenarios: ${supportedScenariosMessage()}`)
}

async function runScenarioCommand(scenario: SmokeScenario): Promise<number> {
  console.log(`[e2e-smoke] start ${scenario.id}: ${scenario.title}`)
  console.log(`[e2e-smoke] command: ${scenario.command.join(' ')}`)

  const proc = spawn({
    cmd: scenario.command,
    cwd: ROOT_DIR,
    stdout: 'inherit',
    stderr: 'inherit',
    env: process.env,
  })

  const exitCode = await proc.exited
  if (exitCode === 0) {
    console.log(`[e2e-smoke] pass ${scenario.id}`)
  } else {
    console.error(`[e2e-smoke] fail ${scenario.id}: command exited with code ${exitCode}`)
  }
  return exitCode
}

export async function runCli(
  argv: string[] = process.argv.slice(2),
  platform: NodeJS.Platform = process.platform,
): Promise<number> {
  try {
    const scenarioId = parseScenarioArg(argv)
    const scenario = resolveRequiredScenario(scenarioId)

    if (scenario.requiredPlatform && scenario.requiredPlatform !== platform) {
      console.error(
        `[e2e-smoke] scenario ${scenario.id} requires ${scenario.requiredPlatform}; current platform is ${platform}. ` +
          'This is a host-environment blocker, not a missing script.',
      )
      return 78
    }

    return await runScenarioCommand(scenario)
  } catch (error) {
    console.error(`[e2e-smoke] ${error instanceof Error ? error.message : String(error)}`)
    return 1
  }
}

if (import.meta.main) {
  process.exit(await runCli())
}
