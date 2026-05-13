#!/usr/bin/env node
/*
 * scripts/check-bundle-budget.cjs (M.16 / T092 + T118 + T124).
 *
 * Pure Node fs + zlib gzip walker that enforces the CLAUDE.md
 * `<code_quality>` per-route bundle budgets against a fresh production build
 * output directory.
 *
 * Per-route JS chunk: <= 200 KB gzipped.
 * Per CSS chunk:      <= 100 KB gzipped.
 * Per image asset:    <= 500 KB raw on disk.
 * Total per-target:   sum of all *.js gzipped sizes <= --total-js-gz-budget.
 *
 * Carve-outs for known-over legacy chunks are supplied via
 *   docs/release/bundle-budget-carveouts.json (default path)
 * or the ROX_BUNDLE_CARVEOUT_JSON env var (raw JSON, useful for tests).
 *
 * Output is a markdown table of the top 5 largest gzipped JS chunks so the CI
 * log is grep-able when budgets drift.
 *
 * Usage:
 *   node scripts/check-bundle-budget.cjs [--dir=<dir>] [--label=<name>]
 *                                        [--mode=production|development]
 *                                        [--build-log=<path>]
 *                                        [--total-js-gz-budget=<bytes>]
 *                                        [--carveout=<json-path>]
 */

'use strict'

const fs = require('node:fs')
const path = require('node:path')
const zlib = require('node:zlib')

const PER_ROUTE_JS_GZ_BUDGET = 200 * 1024
const PER_CSS_GZ_BUDGET = 100 * 1024
const PER_IMAGE_RAW_BUDGET = 500 * 1024
const DEFAULT_TOTAL_JS_GZ_BUDGET = 30 * 1024 * 1024 // generous initial total; ratchet later
const IMAGE_EXTS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.svg',
  '.ico',
  '.avif',
])

const INPUT_CONTAINER_CIRCULAR_RE =
  /Export "InputContainer" of module "apps\/electron\/src\/renderer\/components\/app-shell\/input\/InputContainer\.tsx" was reexported through module "apps\/electron\/src\/renderer\/components\/app-shell\/input\/index\.ts" while both modules are dependencies of each other and will end up in different chunks by current Rollup settings/

function parseArgs(argv) {
  /** @type {Record<string, string>} */
  const out = {}
  for (const raw of argv.slice(2)) {
    if (!raw.startsWith('--')) continue
    const eq = raw.indexOf('=')
    if (eq === -1) {
      out[raw.slice(2)] = 'true'
    } else {
      out[raw.slice(2, eq)] = raw.slice(eq + 1)
    }
  }
  return out
}

function formatBytes(bytes) {
  const units = ['B', 'KB', 'MB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value.toFixed(unit === 0 ? 0 : 2)} ${units[unit]}`
}

/**
 * @param {string} dir
 * @param {string} baseDir
 * @returns {Array<{ relativePath: string; absolutePath: string; ext: string; rawBytes: number }>}
 */
function walk(dir, baseDir) {
  /** @type {Array<{ relativePath: string; absolutePath: string; ext: string; rawBytes: number }>} */
  const out = []
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const abs = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...walk(abs, baseDir))
      continue
    }
    if (!entry.isFile()) continue
    const ext = path.extname(entry.name).toLowerCase()
    const stat = fs.statSync(abs)
    out.push({
      relativePath: path.relative(baseDir, abs),
      absolutePath: abs,
      ext,
      rawBytes: stat.size,
    })
  }
  return out
}

/**
 * @param {string} absPath
 * @returns {number}
 */
function gzippedSize(absPath) {
  const raw = fs.readFileSync(absPath)
  return zlib.gzipSync(raw, { level: 9 }).length
}

/**
 * @param {{ jsChunks?: Array<{ pattern: string; maxGzipBytes: number; ticket?: string }> } | undefined} carveOut
 * @param {string} relPath
 * @returns {{ pattern: string; maxGzipBytes: number; ticket?: string } | null}
 */
function findCarveOut(carveOut, relPath) {
  if (!carveOut || !Array.isArray(carveOut.jsChunks)) return null
  for (const entry of carveOut.jsChunks) {
    if (!entry || typeof entry.pattern !== 'string') continue
    try {
      const re = new RegExp(entry.pattern)
      if (re.test(relPath)) return entry
    } catch {
      continue
    }
  }
  return null
}

function loadCarveOut(rawPath, repoRoot) {
  if (process.env.ROX_BUNDLE_CARVEOUT_JSON) {
    try {
      return JSON.parse(process.env.ROX_BUNDLE_CARVEOUT_JSON)
    } catch (err) {
      console.error(
        `[bundle-budget] failed to parse ROX_BUNDLE_CARVEOUT_JSON: ${
          err instanceof Error ? err.message : String(err)
        }`,
      )
      process.exit(2)
    }
  }
  const carveoutPath = rawPath
    ? path.isAbsolute(rawPath)
      ? rawPath
      : path.join(repoRoot, rawPath)
    : path.join(repoRoot, 'docs/release/bundle-budget-carveouts.json')
  if (!fs.existsSync(carveoutPath)) return undefined
  try {
    return JSON.parse(fs.readFileSync(carveoutPath, 'utf-8'))
  } catch (err) {
    console.error(
      `[bundle-budget] failed to read carve-out file ${carveoutPath}: ${
        err instanceof Error ? err.message : String(err)
      }`,
    )
    process.exit(2)
  }
}

function main() {
  const args = parseArgs(process.argv)
  const repoRoot = path.resolve(__dirname, '..')
  const label = args.label || 'bundle'
  const targetDir = args.dir
    ? path.isAbsolute(args.dir)
      ? args.dir
      : path.join(repoRoot, args.dir)
    : path.join(repoRoot, 'apps/electron/dist/renderer')
  const mode = args.mode || 'production'
  const buildLogPath = args['build-log']
  const totalJsGzBudget = args['total-js-gz-budget']
    ? Number(args['total-js-gz-budget'])
    : DEFAULT_TOTAL_JS_GZ_BUDGET
  const carveOut = loadCarveOut(args.carveout, repoRoot)

  if (!fs.existsSync(targetDir)) {
    console.error(`[bundle-budget] [${label}] missing build output: ${targetDir}`)
    process.exit(1)
  }

  const files = walk(targetDir, targetDir)
  /** @type {Array<{ rel: string; gz: number; raw: number }>} */
  const jsFiles = []
  /** @type {Array<{ rel: string; gz: number; raw: number }>} */
  const cssFiles = []
  /** @type {Array<{ rel: string; raw: number }>} */
  const imageFiles = []
  /** @type {string[]} */
  const mapFiles = []

  for (const file of files) {
    if (file.relativePath.endsWith('.js.map') || file.relativePath.endsWith('.css.map')) {
      mapFiles.push(file.relativePath)
      continue
    }
    if (file.ext === '.js' || file.ext === '.mjs' || file.ext === '.cjs') {
      jsFiles.push({
        rel: file.relativePath,
        gz: gzippedSize(file.absolutePath),
        raw: file.rawBytes,
      })
    } else if (file.ext === '.css') {
      cssFiles.push({
        rel: file.relativePath,
        gz: gzippedSize(file.absolutePath),
        raw: file.rawBytes,
      })
    } else if (IMAGE_EXTS.has(file.ext)) {
      imageFiles.push({ rel: file.relativePath, raw: file.rawBytes })
    }
  }

  jsFiles.sort((a, b) => b.gz - a.gz)
  cssFiles.sort((a, b) => b.gz - a.gz)
  imageFiles.sort((a, b) => b.raw - a.raw)

  const totalJsGz = jsFiles.reduce((sum, f) => sum + f.gz, 0)

  // Markdown table of the largest 5 JS chunks for CI log readability.
  console.log(`[bundle-budget] [${label}] target=${targetDir} mode=${mode}`)
  console.log('')
  console.log('| asset | gz bytes | raw bytes |')
  console.log('| --- | ---: | ---: |')
  for (const file of jsFiles.slice(0, 5)) {
    console.log(`| ${file.rel} | ${file.gz} | ${file.raw} |`)
  }
  console.log('')
  console.log(
    `[bundle-budget] [${label}] js chunks: ${jsFiles.length}, total gz ${totalJsGz} bytes (${formatBytes(
      totalJsGz,
    )}); css chunks: ${cssFiles.length}; images: ${imageFiles.length}`,
  )

  /** @type {string[]} */
  const errors = []
  /** @type {string[]} */
  const warnings = []

  // Per-route JS budget (with carve-outs).
  for (const file of jsFiles) {
    if (file.gz <= PER_ROUTE_JS_GZ_BUDGET) continue
    const carve = findCarveOut(carveOut, file.rel)
    if (!carve) {
      errors.push(
        `JS chunk ${file.rel} = ${file.gz} bytes gzipped exceeds per-route budget ${PER_ROUTE_JS_GZ_BUDGET} bytes`,
      )
      continue
    }
    if (file.gz > carve.maxGzipBytes) {
      errors.push(
        `JS chunk ${file.rel} = ${file.gz} bytes gzipped exceeds carve-out ceiling ${carve.maxGzipBytes} bytes (ticket ${
          carve.ticket || 'unknown'
        })`,
      )
    } else {
      console.log(
        `[bundle-budget] [${label}] carve-out: ${file.rel} = ${file.gz} <= ${carve.maxGzipBytes} bytes (ticket ${
          carve.ticket || 'unknown'
        })`,
      )
    }
  }

  // Per-route CSS budget.
  for (const file of cssFiles) {
    if (file.gz > PER_CSS_GZ_BUDGET) {
      errors.push(
        `CSS chunk ${file.rel} = ${file.gz} bytes gzipped exceeds CSS budget ${PER_CSS_GZ_BUDGET} bytes`,
      )
    }
  }

  // Per-image raw budget.
  for (const file of imageFiles) {
    if (file.raw > PER_IMAGE_RAW_BUDGET) {
      errors.push(
        `Image asset ${file.rel} = ${file.raw} bytes exceeds image budget ${PER_IMAGE_RAW_BUDGET} bytes`,
      )
    }
  }

  // Total JS gzipped budget.
  if (totalJsGz > totalJsGzBudget) {
    errors.push(
      `Total JS gzipped size ${totalJsGz} exceeds total budget ${totalJsGzBudget}`,
    )
  }

  // Source-map policy: warn in production mode, allow in development mode.
  if (mode === 'production' && mapFiles.length > 0) {
    warnings.push(
      `Found ${mapFiles.length} source map files in production build; example: ${mapFiles[0]}`,
    )
  }

  // T118 circular chunk gate: parse build log if provided.
  if (buildLogPath && fs.existsSync(buildLogPath)) {
    const logBody = fs.readFileSync(buildLogPath, 'utf-8')
    if (INPUT_CONTAINER_CIRCULAR_RE.test(logBody)) {
      errors.push(
        'InputContainer Rollup circular chunk warning emitted (see T118)',
      )
    }
  }

  for (const warning of warnings) {
    console.warn(`[bundle-budget] [${label}] WARN ${warning}`)
  }

  if (errors.length > 0) {
    console.error(`\n[bundle-budget] [${label}] FAIL`)
    for (const error of errors) {
      console.error(`- ${error}`)
    }
    process.exit(1)
  }

  console.log(`\n[bundle-budget] [${label}] ok`)
}

main()
