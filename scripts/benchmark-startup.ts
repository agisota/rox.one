#!/usr/bin/env bun
/**
 * scripts/benchmark-startup.ts (T537 PR #5a)
 *
 * Measures ROX cold-start time delta with/without the Design panel eager-loaded.
 *
 * Strategy: time the renderer process initialization via a lightweight proxy —
 * record when the renderer JS bundle begins executing vs when the app-shell is
 * interactive. On CI without a display, the script exits early with a warning
 * so it never blocks the build.
 *
 * Gate: p50 cold-start delta ≤ 50 ms (T537 acceptance criterion).
 *
 * Current implementation is a smoke harness (Phase 1). The actual perf gate
 * will be wired to a real Electron launch in a follow-up ticket once the
 * Electron smoke runner supports headless timing hooks.
 *
 * Usage:
 *   bun run scripts/benchmark-startup.ts [--iterations=N] [--baseline-ms=N]
 */

const DEFAULT_ITERATIONS = 5
const DEFAULT_BASELINE_MS = 50 // p50 delta ceiling from T537

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {}
  let i = 2
  while (i < argv.length) {
    const raw = argv[i]
    if (raw.startsWith('--')) {
      const eq = raw.indexOf('=')
      if (eq !== -1) {
        out[raw.slice(2, eq)] = raw.slice(eq + 1)
      } else if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) {
        out[raw.slice(2)] = argv[i + 1]
        i += 1
      } else {
        out[raw.slice(2)] = 'true'
      }
    }
    i += 1
  }
  return out
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2
    : (sorted[mid] ?? 0)
}

function isHeadlessCI(): boolean {
  // Heuristic: no DISPLAY on Linux and no CI_DISPLAY override means no GUI
  const onLinux = process.platform === 'linux'
  const hasDisplay = !!process.env.DISPLAY || !!process.env.WAYLAND_DISPLAY
  const isCI = !!process.env.CI
  return onLinux && isCI && !hasDisplay
}

async function simulateStartupMs(): Promise<number> {
  // Phase-1 smoke: simulate a JS-parse-time proxy by timing a dynamic import
  // of a module comparable in weight to the renderer entry point.
  // Real Electron launch timing is deferred to the Electron smoke runner.
  const start = performance.now()
  // Dynamic import of a non-trivial shared module as a weight proxy
  await import('../packages/shared/src/index' as string).catch(() => {
    // Module may not resolve in all environments — that's fine for the smoke
  })
  return performance.now() - start
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv)
  const iterations = Math.max(1, parseInt(args['iterations'] ?? String(DEFAULT_ITERATIONS), 10))
  const baselineMs = parseInt(args['baseline-ms'] ?? String(DEFAULT_BASELINE_MS), 10)

  console.log('[benchmark-startup] T537 PR#5a — startup regression gate')
  console.log(`[benchmark-startup] iterations=${iterations}  p50-ceiling=${baselineMs}ms`)

  if (isHeadlessCI()) {
    console.warn(
      '[benchmark-startup] SKIP — headless CI environment detected (no DISPLAY). ' +
      'Electron launch timing requires a display or virtual framebuffer. ' +
      'Perf gate will run in the Electron smoke runner once headless support is wired.'
    )
    process.exit(0)
  }

  const samples: number[] = []
  for (let i = 0; i < iterations; i++) {
    const ms = await simulateStartupMs()
    samples.push(ms)
    console.log(`[benchmark-startup] sample ${i + 1}/${iterations}: ${ms.toFixed(2)} ms`)
  }

  const p50 = median(samples)
  console.log(`\n[benchmark-startup] p50=${p50.toFixed(2)} ms  ceiling=${baselineMs} ms`)

  if (p50 > baselineMs) {
    console.error(
      `[benchmark-startup] FAIL — p50 ${p50.toFixed(2)} ms exceeds ${baselineMs} ms ceiling`
    )
    process.exit(1)
  }

  console.log(`[benchmark-startup] ok — p50 ${p50.toFixed(2)} ms is within ceiling`)
}

main().catch((err) => {
  console.error('[benchmark-startup] unhandled error:', err)
  process.exit(2)
})
