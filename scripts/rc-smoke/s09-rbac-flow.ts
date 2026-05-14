#!/usr/bin/env bun
/**
 * RC S09 RBAC admin flow smoke harness.
 *
 * Walks the deterministic RBAC admin path covered by current tests:
 *   1. Create role
 *   2. Grant scope on workspace A
 *   3. Assert workspace B remains unreachable
 *   4. Revoke
 *   5. Assert revoked
 *
 * This mirrors the S04-S08 pattern in `scripts/e2e-smoke.ts` (a standalone
 * scenario file with explicit test paths and a spawn-bun-test runner) but
 * lives in `scripts/rc-smoke/` to keep S09 isolated from codex-managed
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

export const S09_RBAC_FLOW_TESTS = [
  // Step 1 + 2: role create / grant scope on workspace A
  'packages/server-core/src/handlers/rpc/__tests__/roles.test.ts',
  'packages/server-core/src/handlers/rpc/__tests__/roles-audit.test.ts',
  'packages/server-core/src/handlers/rpc/__tests__/roles-rate-limit.test.ts',
  // Step 3: workspace B unreachable -> policy/scope checks
  'packages/shared/src/auth/__tests__/policy-engine.test.ts',
  'packages/shared/src/auth/__tests__/policy-engine.edge-cases.test.ts',
  'packages/shared/src/auth/__tests__/scope-forgery.property.test.ts',
  'packages/shared/src/auth/__tests__/rbac-resolver.test.ts',
  // Step 4 + 5: revoke + revoked-state propagation
  'packages/shared/src/auth/__tests__/state.test.ts',
  'packages/shared/src/auth/__tests__/integrity-pass.test.ts',
  // Renderer settings/state contract for admin-side flow
  'apps/electron/src/renderer/components/settings/rbac/__tests__/team-management-state.test.ts',
  'apps/electron/src/renderer/components/settings/rbac/__tests__/roles-panel-state.test.ts',
] as const

export const S09_SCENARIO: SmokeScenario = {
  id: 's09-rbac-admin-flow',
  title:
    'RC S09 RBAC admin flow: create role, grant on workspace A, assert B unreachable, revoke, assert revoked',
  command: ['bun', 'test', ...S09_RBAC_FLOW_TESTS],
}

export function resolveS09Scenario(): SmokeScenario {
  return S09_SCENARIO
}

async function runScenarioCommand(scenario: SmokeScenario): Promise<number> {
  console.log(`[rc-smoke/s09] start ${scenario.id}: ${scenario.title}`)
  console.log(`[rc-smoke/s09] command: ${scenario.command.join(' ')}`)

  const proc = spawn({
    cmd: scenario.command,
    cwd: ROOT_DIR,
    stdout: 'inherit',
    stderr: 'inherit',
    env: process.env,
  })

  const exitCode = await proc.exited
  if (exitCode === 0) {
    console.log(`[rc-smoke/s09] pass ${scenario.id}`)
  } else {
    console.error(`[rc-smoke/s09] fail ${scenario.id}: command exited with code ${exitCode}`)
  }
  return exitCode
}

export async function runCli(): Promise<number> {
  try {
    return await runScenarioCommand(S09_SCENARIO)
  } catch (error) {
    console.error(`[rc-smoke/s09] ${error instanceof Error ? error.message : String(error)}`)
    return 1
  }
}

if (import.meta.main) {
  process.exit(await runCli())
}
