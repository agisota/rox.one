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
