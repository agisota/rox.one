#!/usr/bin/env bun
/**
 * RC S10 mission lifecycle smoke harness.
 *
 * Walks the deterministic mission lifecycle path covered by current tests:
 *   1. Create mission
 *   2. Dispatch Start
 *   3. Dispatch Complete
 *   4. Assert audit-event emitted on each transition
 *
 * Mirrors the S04-S08 pattern in `scripts/e2e-smoke.ts` (a standalone
 * scenario file with explicit test paths and a spawn-bun-test runner) but
 * lives in `scripts/rc-smoke/` to keep S10 isolated from codex-managed
 * harness wiring.
 */
import { spawn } from 'bun'
import { join } from 'node:path'

const ROOT_DIR = join(import.meta.dir, '..', '..')

export interface SmokeScenario {
  id: string
  title: string
  command: string[]
}

export const S10_MISSION_LIFECYCLE_TESTS = [
  // Step 1: mission create / store / id
  'packages/server-core/src/missions/__tests__/mission-id.test.ts',
  'packages/server-core/src/missions/__tests__/mission-store.test.ts',
  // Step 2 + 3: dispatch Start / Complete and state transitions
  'packages/server-core/src/missions/__tests__/state.test.ts',
  'packages/server-core/src/missions/__tests__/transitions.test.ts',
  'packages/server-core/src/missions/__tests__/scheduler.test.ts',
  'packages/server-core/src/missions/__tests__/host.test.ts',
  // RPC dispatch surface for Start/Complete
  'packages/server-core/src/handlers/rpc/__tests__/missions-rpc.test.ts',
  'packages/server-core/src/handlers/rpc/__tests__/missions-rate-limit.test.ts',
  // Step 4: audit-event emission on lifecycle transitions
  'packages/server-core/src/missions/__tests__/scheduler-audit.test.ts',
  'packages/shared/src/observability/__tests__/audit-event.test.ts',
  'packages/shared/src/observability/__tests__/audit-producer.test.ts',
  'packages/server-core/src/audit/__tests__/audit-event-store.test.ts',
  // Shared workbench lifecycle contract
  'packages/shared/src/workbench/__tests__/mission-lifecycle.test.ts',
] as const

export const S10_SCENARIO: SmokeScenario = {
  id: 's10-mission-lifecycle',
  title:
    'RC S10 mission lifecycle: create, dispatch Start, dispatch Complete, assert audit-event emitted',
  command: ['bun', 'test', ...S10_MISSION_LIFECYCLE_TESTS],
}

export function resolveS10Scenario(): SmokeScenario {
  return S10_SCENARIO
}

async function runScenarioCommand(scenario: SmokeScenario): Promise<number> {
  console.log(`[rc-smoke/s10] start ${scenario.id}: ${scenario.title}`)
  console.log(`[rc-smoke/s10] command: ${scenario.command.join(' ')}`)

  const proc = spawn({
    cmd: scenario.command,
    cwd: ROOT_DIR,
    stdout: 'inherit',
    stderr: 'inherit',
    env: process.env,
  })

  const exitCode = await proc.exited
  if (exitCode === 0) {
    console.log(`[rc-smoke/s10] pass ${scenario.id}`)
  } else {
    console.error(`[rc-smoke/s10] fail ${scenario.id}: command exited with code ${exitCode}`)
  }
  return exitCode
}

export async function runCli(): Promise<number> {
  try {
    return await runScenarioCommand(S10_SCENARIO)
  } catch (error) {
    console.error(`[rc-smoke/s10] ${error instanceof Error ? error.message : String(error)}`)
    return 1
  }
}

if (import.meta.main) {
  process.exit(await runCli())
}
