// Bun tests for scripts/check-bundle-budget.cjs (M.16 / T092 + T118 + T124).
//
// These tests use fixture build trees (tmp dirs) so they stay deterministic and
// CI-fast: they do not run `bun run electron:build` themselves. Live build
// validation happens in `bun run validate:bundle-policy` which gates the gzip
// budget in CI after the real Electron/WebUI/Viewer builds.
//
// The CLAUDE.md `<code_quality>` budget is per-route JS bundle ≤ 200 KB gzipped.
// `scripts/check-bundle-budget.cjs` enforces that ceiling against fresh
// production outputs and reads a carve-out allowlist for legacy fat chunks.

import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { gzipSync } from 'node:zlib'

const repoRoot = path.resolve(__dirname, '..', '..')
const checker = path.join(repoRoot, 'scripts', 'check-bundle-budget.cjs')

type Asset = { rel: string; bytes: Buffer | string }

function makeFixtureTree(assets: Asset[]): string {
  const tmpRoot = mkdtempSync(path.join(tmpdir(), 'rox-m16-budget-'))
  for (const asset of assets) {
    const full = path.join(tmpRoot, asset.rel)
    mkdirSync(path.dirname(full), { recursive: true })
    writeFileSync(full, asset.bytes)
  }
  return tmpRoot
}

function compressible(targetGzipBytes: number): Buffer {
  // Highly compressible payload: a repeated short pattern. Tune length so the
  // gzipped output lands close to targetGzipBytes.
  const raw = Buffer.alloc(targetGzipBytes * 12, 'a')
  let gz = gzipSync(raw)
  if (gz.length >= targetGzipBytes) return raw
  // Expand until gz crosses the target.
  const grown = Buffer.alloc(targetGzipBytes * 40, 'a')
  gz = gzipSync(grown)
  return grown
}

function incompressible(targetGzipBytes: number): Buffer {
  // Random bytes are not gzip-compressible, so raw size approximates gz size.
  const buf = Buffer.alloc(targetGzipBytes)
  for (let i = 0; i < buf.length; i += 1) {
    buf[i] = Math.floor(Math.random() * 256)
  }
  return buf
}

function runChecker(args: string[], env: Record<string, string> = {}): {
  status: number | null
  stdout: string
  stderr: string
} {
  const result = spawnSync(process.execPath, [checker, ...args], {
    cwd: repoRoot,
    env: { ...process.env, ...env },
    encoding: 'utf-8',
  })
  return { status: result.status, stdout: result.stdout, stderr: result.stderr }
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

describe('check-bundle-budget.cjs (M.16 gzipped budget gate)', () => {
  test('passes when every JS chunk is under 200 KB gzipped', () => {
    const dir = makeFixtureTree([
      { rel: 'assets/route-a.js', bytes: compressible(20_000) },
      { rel: 'assets/route-b.js', bytes: compressible(50_000) },
      { rel: 'assets/style.css', bytes: 'body{color:#000}' },
    ])
    cleanupDirs.push(dir)
    const res = runChecker([`--dir=${dir}`, '--label=test'])
    expect(res.status).toBe(0)
    expect(res.stdout).toContain('[bundle-budget]')
    expect(res.stdout.toLowerCase()).toContain('test')
  })

  test('fails when an unknown JS chunk exceeds the 200 KB gzipped per-route budget', () => {
    const dir = makeFixtureTree([
      { rel: 'assets/route-fat.js', bytes: incompressible(220_000) },
    ])
    cleanupDirs.push(dir)
    const res = runChecker([`--dir=${dir}`, '--label=test'])
    expect(res.status).not.toBe(0)
    expect(`${res.stdout}${res.stderr}`).toContain('route-fat.js')
  })

  test('fails when a CSS chunk exceeds the 100 KB gzipped budget', () => {
    const dir = makeFixtureTree([
      { rel: 'assets/heavy.css', bytes: incompressible(110_000) },
    ])
    cleanupDirs.push(dir)
    const res = runChecker([`--dir=${dir}`, '--label=test'])
    expect(res.status).not.toBe(0)
    expect(`${res.stdout}${res.stderr}`).toMatch(/heavy\.css/)
  })

  test('fails when an image asset exceeds the 500 KB budget', () => {
    const dir = makeFixtureTree([
      { rel: 'assets/big.png', bytes: incompressible(600_000) },
    ])
    cleanupDirs.push(dir)
    const res = runChecker([`--dir=${dir}`, '--label=test'])
    expect(res.status).not.toBe(0)
    expect(`${res.stdout}${res.stderr}`).toMatch(/big\.png/)
  })

  test('respects the carve-out allowlist for known-over legacy chunks', () => {
    const dir = makeFixtureTree([
      { rel: 'assets/index-LEGACY.js', bytes: incompressible(220_000) },
    ])
    cleanupDirs.push(dir)
    const carveOut = JSON.stringify({
      jsChunks: [
        { pattern: 'index-LEGACY\\.js', maxGzipBytes: 230_000, ticket: 'T999' },
      ],
    })
    const res = runChecker([`--dir=${dir}`, '--label=test'], {
      ROX_BUNDLE_CARVEOUT_JSON: carveOut,
    })
    expect(res.status).toBe(0)
    expect(res.stdout).toContain('carve-out')
  })

  test('fails when a carve-out chunk grows past its recorded ceiling', () => {
    const dir = makeFixtureTree([
      { rel: 'assets/index-LEGACY.js', bytes: incompressible(280_000) },
    ])
    cleanupDirs.push(dir)
    const carveOut = JSON.stringify({
      jsChunks: [
        { pattern: 'index-LEGACY\\.js', maxGzipBytes: 230_000, ticket: 'T999' },
      ],
    })
    const res = runChecker([`--dir=${dir}`, '--label=test'], {
      ROX_BUNDLE_CARVEOUT_JSON: carveOut,
    })
    expect(res.status).not.toBe(0)
    expect(`${res.stdout}${res.stderr}`).toMatch(/index-LEGACY\.js/)
  })

  test('fails on missing build output (label-scoped)', () => {
    const dir = path.join(tmpdir(), 'rox-m16-does-not-exist-xyz')
    const res = runChecker([`--dir=${dir}`, '--label=test'])
    expect(res.status).not.toBe(0)
    expect(`${res.stdout}${res.stderr}`).toMatch(/missing build output/i)
  })

  test('renders a markdown table of the largest 5 chunks to stdout', () => {
    const dir = makeFixtureTree([
      { rel: 'assets/a.js', bytes: compressible(10_000) },
      { rel: 'assets/b.js', bytes: compressible(20_000) },
      { rel: 'assets/c.js', bytes: compressible(30_000) },
      { rel: 'assets/d.js', bytes: compressible(5_000) },
      { rel: 'assets/e.js', bytes: compressible(15_000) },
      { rel: 'assets/f.js', bytes: compressible(8_000) },
    ])
    cleanupDirs.push(dir)
    const res = runChecker([`--dir=${dir}`, '--label=test'])
    expect(res.status).toBe(0)
    expect(res.stdout).toContain('| asset')
    expect(res.stdout).toContain('| gz bytes')
  })
})

describe('check-bundle-budget.cjs source-map policy', () => {
  test('warns when source maps are present in a prod-mode tree', () => {
    const dir = makeFixtureTree([
      { rel: 'assets/route.js', bytes: compressible(20_000) },
      { rel: 'assets/route.js.map', bytes: '{"version":3}' },
    ])
    cleanupDirs.push(dir)
    const res = runChecker([`--dir=${dir}`, '--label=test', '--mode=production'])
    expect(`${res.stdout}${res.stderr}`).toMatch(/source ?map/i)
  })

  test('passes when source maps are present in a dev-mode tree', () => {
    const dir = makeFixtureTree([
      { rel: 'assets/route.js', bytes: compressible(20_000) },
      { rel: 'assets/route.js.map', bytes: '{"version":3}' },
    ])
    cleanupDirs.push(dir)
    const res = runChecker([`--dir=${dir}`, '--label=test', '--mode=development'])
    expect(res.status).toBe(0)
  })
})

describe('check-bundle-budget.cjs InputContainer circular chunk gate (T118)', () => {
  test('fails when a captured build log contains the InputContainer circular warning', () => {
    const dir = makeFixtureTree([
      { rel: 'assets/route.js', bytes: compressible(20_000) },
    ])
    cleanupDirs.push(dir)
    const fakeLog = path.join(dir, 'build.log')
    writeFileSync(
      fakeLog,
      'Export "InputContainer" of module "apps/electron/src/renderer/components/app-shell/input/InputContainer.tsx" was reexported through module "apps/electron/src/renderer/components/app-shell/input/index.ts" while both modules are dependencies of each other and will end up in different chunks by current Rollup settings.\n',
    )
    const res = runChecker([
      `--dir=${dir}`,
      '--label=test',
      `--build-log=${fakeLog}`,
    ])
    expect(res.status).not.toBe(0)
    expect(`${res.stdout}${res.stderr}`).toMatch(/InputContainer/)
  })

  test('passes when the build log has no circular warning', () => {
    const dir = makeFixtureTree([
      { rel: 'assets/route.js', bytes: compressible(20_000) },
    ])
    cleanupDirs.push(dir)
    const fakeLog = path.join(dir, 'build.log')
    writeFileSync(fakeLog, 'vite v6.0.0 building for production...\n')
    const res = runChecker([
      `--dir=${dir}`,
      '--label=test',
      `--build-log=${fakeLog}`,
    ])
    expect(res.status).toBe(0)
  })
})
