/**
 * benchmark-startup.test.ts (T537 PR #5a)
 *
 * Smoke check: benchmark-startup.ts runs without error in the test environment.
 * On headless CI (no DISPLAY) the script exits 0 with a SKIP message.
 * On environments with a display it runs sample iterations and reports p50.
 */

import { describe, test, expect } from 'bun:test'
import { spawnSync } from 'node:child_process'
import path from 'node:path'

const repoRoot = path.resolve(__dirname, '..', '..')
const script = path.join(repoRoot, 'scripts', 'benchmark-startup.ts')

function runScript(args: string[] = [], env: Record<string, string> = {}): {
  status: number | null
  stdout: string
  stderr: string
} {
  const result = spawnSync('bun', ['run', script, ...args], {
    cwd: repoRoot,
    env: { ...process.env, ...env },
    encoding: 'utf-8',
    timeout: 30_000,
  })
  return {
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  }
}

describe('benchmark-startup.ts smoke (T537 PR#5a)', () => {
  test('script runs without error', () => {
    const res = runScript(['--iterations=1'])
    // Accept exit 0 always — on headless CI it skips, on display it times
    expect(res.status).toBe(0)
  })

  test('outputs benchmark-startup prefix in output', () => {
    const res = runScript(['--iterations=1'])
    const output = res.stdout + res.stderr
    expect(output).toContain('[benchmark-startup]')
  })

  test('skips gracefully on headless CI (DISPLAY unset, CI=true)', () => {
    // Simulate headless CI on Linux: strip DISPLAY, set CI=true
    const res = runScript(['--iterations=1'], {
      CI: 'true',
      DISPLAY: '',
      WAYLAND_DISPLAY: '',
    })
    expect(res.status).toBe(0)
    const output = res.stdout + res.stderr
    // On a linux CI environment the SKIP branch fires; on non-linux it may run normally
    // Either way exit code must be 0 and output must contain the header
    expect(output).toContain('[benchmark-startup]')
  })
})
