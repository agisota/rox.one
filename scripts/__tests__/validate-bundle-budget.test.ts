// TDD tests for scripts/validate-bundle-budget.ts (T537 PR #5a).
//
// Tests the new validate-bundle-budget.ts script that enforces:
//   - total renderer + main bundle does not exceed baseline + 80 MB
//
// Uses fixture trees so tests stay deterministic and CI-fast without
// requiring a real Electron build.

import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

const repoRoot = path.resolve(__dirname, '..', '..')
const script = path.join(repoRoot, 'scripts', 'validate-bundle-budget.ts')
const budgetJson = path.join(repoRoot, 'bundle-budget.json')

type Asset = { rel: string; bytes: Buffer | string }

function makeFixtureTree(assets: Asset[]): string {
  const tmpRoot = mkdtempSync(path.join(tmpdir(), 'rox-bundle-budget-'))
  for (const asset of assets) {
    const full = path.join(tmpRoot, asset.rel)
    mkdirSync(path.dirname(full), { recursive: true })
    writeFileSync(full, asset.bytes)
  }
  return tmpRoot
}

function makeBuffer(bytes: number, fill = 0x61): Buffer {
  return Buffer.alloc(bytes, fill)
}

function runScript(args: string[], env: Record<string, string> = {}): {
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
  return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' }
}

const cleanupDirs: string[] = []

beforeEach(() => {
  cleanupDirs.length = 0
})

afterEach(() => {
  for (const dir of cleanupDirs) {
    rmSync(dir, { recursive: true, force: true })
  }
})

describe('validate-bundle-budget.ts (T537 PR#5a bundle gate)', () => {
  test('fails when total dist size exceeds baseline + 80 MB allowance', () => {
    const dir = makeFixtureTree([
      // Single renderer file larger than any sane budget + 80 MB
      { rel: 'main.js', bytes: makeBuffer(100 * 1024 * 1024) }, // 100 MB raw
    ])
    cleanupDirs.push(dir)

    const res = runScript(['--dir', dir, '--budget', budgetJson])
    expect(res.status).not.toBe(0)
    const output = res.stdout + res.stderr
    expect(output).toMatch(/over budget|exceeds|FAIL/i)
  })

  test('passes when total dist size is within baseline + 80 MB', () => {
    const dir = makeFixtureTree([
      // Tiny fixture — well within any budget
      { rel: 'renderer.js', bytes: makeBuffer(1024) },
      { rel: 'main.js', bytes: makeBuffer(512) },
    ])
    cleanupDirs.push(dir)

    const res = runScript(['--dir', dir, '--budget', budgetJson])
    expect(res.status).toBe(0)
    const output = res.stdout + res.stderr
    expect(output).toMatch(/ok|pass/i)
  })

  test('fails when the dist directory does not exist', () => {
    const dir = path.join(tmpdir(), 'rox-bundle-does-not-exist-xyz')
    const res = runScript(['--dir', dir, '--budget', budgetJson])
    expect(res.status).not.toBe(0)
    const output = res.stdout + res.stderr
    expect(output).toMatch(/missing|not found|no such/i)
  })

  test('outputs a summary line with total size information', () => {
    const dir = makeFixtureTree([
      { rel: 'renderer.js', bytes: makeBuffer(2048) },
    ])
    cleanupDirs.push(dir)

    const res = runScript(['--dir', dir, '--budget', budgetJson])
    expect(res.status).toBe(0)
    const output = res.stdout + res.stderr
    // Should emit something mentioning total bytes / MB
    expect(output).toMatch(/total|size/i)
  })
})
