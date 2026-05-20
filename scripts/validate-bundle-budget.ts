#!/usr/bin/env bun
/**
 * scripts/validate-bundle-budget.ts (T537 PR #5a)
 *
 * Enforces a design-payload budget on top of the existing per-route JS gate.
 * Reads bundle-budget.json for:
 *   - baselines.renderer.totalRawBytes — committed raw byte baseline for the renderer dist
 *   - baselines.main.totalRawBytes     — committed raw byte baseline for the main dist
 *   - designAllowanceMb                — extra headroom allowed for design assets (default 80 MB)
 *
 * Fails when the measured total of all files in --dir exceeds:
 *   baseline.totalRawBytes + (designAllowanceMb * 1024 * 1024)
 *
 * When baseline is 0 (initial state / not yet measured) the gate still passes
 * for reasonable (< 80 MB) bundles so CI is unblocked until a real build
 * produces the first baseline.
 *
 * Usage:
 *   bun run scripts/validate-bundle-budget.ts --dir=<dist-dir> --budget=<budget-json>
 *   bun run scripts/validate-bundle-budget.ts --dir apps/electron/dist/renderer --budget bundle-budget.json
 */

import { existsSync, readdirSync, statSync, readFileSync } from 'node:fs'
import path from 'node:path'

const MB = 1024 * 1024

interface BudgetJson {
  lastBaselined?: string
  designAllowanceMb?: number
  baselines?: {
    renderer?: { totalRawBytes?: number }
    main?: { totalRawBytes?: number }
  }
}

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

function formatBytes(bytes: number): string {
  if (bytes >= MB) return `${(bytes / MB).toFixed(2)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(2)} KB`
  return `${bytes} B`
}

function walkRawBytes(dir: string): number {
  let total = 0
  const entries = readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const abs = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      total += walkRawBytes(abs)
    } else if (entry.isFile()) {
      total += statSync(abs).size
    }
  }
  return total
}

function main(): void {
  const args = parseArgs(process.argv)

  const dir = args['dir']
  const budgetPath = args['budget']

  if (!dir) {
    console.error('[bundle-budget] error: --dir is required')
    process.exit(2)
  }
  if (!budgetPath) {
    console.error('[bundle-budget] error: --budget is required')
    process.exit(2)
  }

  const resolvedDir = path.isAbsolute(dir) ? dir : path.resolve(process.cwd(), dir)
  const resolvedBudget = path.isAbsolute(budgetPath)
    ? budgetPath
    : path.resolve(process.cwd(), budgetPath)

  if (!existsSync(resolvedDir)) {
    console.error(`[bundle-budget] missing dist directory: ${resolvedDir}`)
    process.exit(1)
  }

  if (!existsSync(resolvedBudget)) {
    console.error(`[bundle-budget] missing budget file: ${resolvedBudget}`)
    process.exit(1)
  }

  let budget: BudgetJson
  try {
    budget = JSON.parse(readFileSync(resolvedBudget, 'utf-8')) as BudgetJson
  } catch (err) {
    console.error(`[bundle-budget] failed to parse budget JSON: ${err instanceof Error ? err.message : String(err)}`)
    process.exit(2)
  }

  const allowanceMb = budget.designAllowanceMb ?? 80
  const allowanceBytes = allowanceMb * MB

  // Determine baseline for the dir label (renderer vs main)
  const dirLabel = resolvedDir.includes('/dist/main') ? 'main' : 'renderer'
  const baseline = (budget.baselines?.[dirLabel as 'renderer' | 'main']?.totalRawBytes) ?? 0
  const ceiling = baseline + allowanceBytes

  const totalBytes = walkRawBytes(resolvedDir)

  console.log(`[bundle-budget] dir=${resolvedDir}`)
  console.log(`[bundle-budget] label=${dirLabel}  lastBaselined=${budget.lastBaselined ?? 'unknown'}`)
  console.log(`[bundle-budget] total size: ${formatBytes(totalBytes)}`)
  console.log(`[bundle-budget] baseline: ${formatBytes(baseline)}  allowance: ${allowanceMb} MB  ceiling: ${formatBytes(ceiling)}`)

  if (totalBytes > ceiling) {
    console.error(`\n[bundle-budget] FAIL — total ${formatBytes(totalBytes)} exceeds budget ceiling ${formatBytes(ceiling)} (baseline ${formatBytes(baseline)} + ${allowanceMb} MB design allowance)`)
    process.exit(1)
  }

  console.log(`\n[bundle-budget] ok — total ${formatBytes(totalBytes)} is within ceiling ${formatBytes(ceiling)}`)
}

main()
