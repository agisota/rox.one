import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
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

writeFileSync(join(TARGET_DIR, 'MANIFEST.json'), `${JSON.stringify({
  schema: 'rox-design-runtime-manifest.v1',
  sourceRoot,
  version,
  copiedAt: new Date().toISOString(),
  copiedPaths: COPY_PATHS,
}, null, 2)}\n`)

console.log(`[rox-design:prepare] prepared Open Design ${version} runtime at ${TARGET_DIR}`)
console.log('[rox-design:prepare] payload is gitignored; build artifacts pick it up through electron-builder resources.')
