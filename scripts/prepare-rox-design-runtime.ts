import { cpSync, createReadStream, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { createHash } from 'crypto'
import { dirname, join, resolve } from 'path'

const ROOT_DIR = join(import.meta.dir, '..')
const DEFAULT_SOURCE = '/Applications/Open Design.app/Contents/Resources'
const TARGET_DIR = resolve(ROOT_DIR, 'apps/electron/resources/rox-design')
const args = new Set(process.argv.slice(2))
const checkOnly = args.has('--check')
const force = args.has('--force')
const sourceRoot = resolve(process.env.ROX_DESIGN_SOURCE_RESOURCES || DEFAULT_SOURCE)

const REQUIRED_PATHS = [
  'open-design-config.json',
  'app/prebundled/daemon/daemon-sidecar.mjs',
  'app/prebundled/daemon/daemon-cli.mjs',
  'app/node_modules/better-sqlite3',
  'app/node_modules/blake3-wasm',
  'app/prebundled/web-sidecar.mjs',
  'open-design/bin/node',
  'open-design/skills',
  'open-design/design-systems',
  'open-design/design-templates',
  'open-design/prompt-templates',
  'open-design-web-standalone/apps/web/server.js',
]

const COPY_PATHS = [
  'open-design-config.json',
  'app/prebundled',
  'app/node_modules',
  'open-design',
  'open-design-web-standalone',
]

/** Relative paths of the entry-point files that must be digest-verified at runtime launch. */
const DIGEST_PATHS = [
  'app/prebundled/daemon/daemon-sidecar.mjs',
  'app/prebundled/daemon/daemon-cli.mjs',
  'app/prebundled/web-sidecar.mjs',
  'open-design/bin/node',
  'open-design-web-standalone/apps/web/server.js',
]

async function sha256File(filePath: string): Promise<string> {
  return new Promise((resolveHash, rejectHash) => {
    const hash = createHash('sha256')
    const stream = createReadStream(filePath)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', () => resolveHash(hash.digest('hex')))
    stream.on('error', rejectHash)
  })
}

function fail(message: string): never {
  console.error(`[rox-design:prepare] ${message}`)
  process.exit(1)
}

function validateSource(): { version: string } {
  if (!existsSync(sourceRoot)) fail(`source resources root does not exist: ${sourceRoot}`)
  const missing = REQUIRED_PATHS.filter((relativePath) => !existsSync(join(sourceRoot, relativePath)))
  if (missing.length > 0) fail(`source resources root is incomplete:\n${missing.map((p) => `  - ${p}`).join('\n')}`)

  const config = JSON.parse(readFileSync(join(sourceRoot, 'open-design-config.json'), 'utf8')) as { appVersion?: string }
  return { version: config.appVersion || 'unknown' }
}

function targetHasPayload(): boolean {
  if (!existsSync(TARGET_DIR)) return false
  return readdirSync(TARGET_DIR).some((entry) => !['README.md', '.DS_Store'].includes(entry))
}

const { version } = validateSource()

if (checkOnly) {
  console.log(`[rox-design:prepare] source ok: ${sourceRoot}`)
  console.log(`[rox-design:prepare] Open Design version: ${version}`)
  console.log(`[rox-design:prepare] target: ${TARGET_DIR}`)
  process.exit(0)
}

if (targetHasPayload() && !force) {
  fail(`target already contains a runtime payload: ${TARGET_DIR}\nRe-run with --force to replace it.`)
}

mkdirSync(TARGET_DIR, { recursive: true })
for (const entry of readdirSync(TARGET_DIR)) {
  if (entry === 'README.md') continue
  rmSync(join(TARGET_DIR, entry), { recursive: true, force: true })
}

for (const relativePath of COPY_PATHS) {
  const from = join(sourceRoot, relativePath)
  const to = join(TARGET_DIR, relativePath)
  mkdirSync(dirname(to), { recursive: true })
  cpSync(from, to, { recursive: true, force: true, dereference: true })
  console.log(`[rox-design:prepare] copied ${relativePath}`)
}

// Compute per-file SHA-256 digests for security perimeter entry points (B-H2).
// These are verified at runtime launch in RoxDesignRuntimeManager.start().
const fileDigests: Record<string, string> = {}
for (const relativePath of DIGEST_PATHS) {
  const absPath = join(TARGET_DIR, relativePath)
  if (existsSync(absPath)) {
    fileDigests[relativePath] = await sha256File(absPath)
    console.log(`[rox-design:prepare] digested ${relativePath} (${fileDigests[relativePath].slice(0, 12)}…)`)
  } else {
    console.warn(`[rox-design:prepare] warn: digest path not found, skipping: ${relativePath}`)
  }
}

writeFileSync(join(TARGET_DIR, 'MANIFEST.json'), `${JSON.stringify({
  schema: 'rox-design-runtime-manifest.v1',
  sourceRoot,
  version,
  copiedAt: new Date().toISOString(),
  copiedPaths: COPY_PATHS,
  fileDigests,
}, null, 2)}\n`)

console.log(`[rox-design:prepare] prepared Open Design ${version} runtime at ${TARGET_DIR}`)
console.log('[rox-design:prepare] payload is gitignored; build artifacts pick it up through electron-builder resources.')
