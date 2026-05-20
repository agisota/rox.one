import { createHash } from 'crypto'
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { dirname, join, resolve } from 'path'
import { spawnSync } from 'child_process'

const ROOT_DIR = join(import.meta.dir, '..')
const DEFAULT_SOURCE = '/Applications/Open Design.app/Contents/Resources'
const TARGET_DIR = resolve(ROOT_DIR, 'apps/electron/resources/rox-design')

const argv = process.argv.slice(2)
const flagSet = new Set<string>()
const flagVal: Record<string, string> = {}
for (const a of argv) {
  if (a.includes('=')) {
    const idx = a.indexOf('=')
    flagVal[a.slice(0, idx)] = a.slice(idx + 1)
  } else {
    flagSet.add(a)
  }
}
const checkOnly = flagSet.has('--check')
const force = flagSet.has('--force')
const fromArchive = flagVal['--from-archive']
const expectedSha = flagVal['--expected-sha256']
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

function log(message: string): void {
  console.log(`[rox-design:prepare] ${message}`)
}

function validateSource(): { version: string } {
  if (!existsSync(sourceRoot)) fail(`source resources root does not exist: ${sourceRoot}`)
  const missing = REQUIRED_PATHS.filter((relativePath) => !existsSync(join(sourceRoot, relativePath)))
  if (missing.length > 0) fail(`source resources root is incomplete:\n${missing.map((p) => `  - ${p}`).join('\n')}`)

  const config = JSON.parse(readFileSync(join(sourceRoot, 'open-design-config.json'), 'utf8')) as { appVersion?: string }
  return { version: config.appVersion || 'unknown' }
}

function validateTargetAfterExtract(): { version: string } {
  const missing = REQUIRED_PATHS.filter((relativePath) => !existsSync(join(TARGET_DIR, relativePath)))
  if (missing.length > 0) fail(`extracted archive is incomplete:\n${missing.map((p) => `  - ${p}`).join('\n')}`)
  const config = JSON.parse(readFileSync(join(TARGET_DIR, 'open-design-config.json'), 'utf8')) as { appVersion?: string }
  return { version: config.appVersion || 'unknown' }
}

function targetHasPayload(): boolean {
  if (!existsSync(TARGET_DIR)) return false
  return readdirSync(TARGET_DIR).some((entry) => !['README.md', 'NOTICES.md', '.DS_Store'].includes(entry))
}

function clearTarget(): void {
  mkdirSync(TARGET_DIR, { recursive: true })
  for (const entry of readdirSync(TARGET_DIR)) {
    if (entry === 'README.md' || entry === 'NOTICES.md') continue
    rmSync(join(TARGET_DIR, entry), { recursive: true, force: true })
  }
}

async function downloadArchive(url: string, dest: string): Promise<void> {
  log(`downloading archive: ${url}`)
  const res = await fetch(url, { redirect: 'follow' })
  if (!res.ok) fail(`archive download failed: HTTP ${res.status} ${res.statusText} for ${url}`)
  const buffer = Buffer.from(await res.arrayBuffer())
  writeFileSync(dest, buffer)
  log(`downloaded ${buffer.length} bytes → ${dest}`)
}

function verifySha256(filePath: string, expected: string): void {
  const hash = createHash('sha256').update(readFileSync(filePath)).digest('hex')
  if (hash.toLowerCase() !== expected.toLowerCase()) {
    fail(`SHA-256 mismatch:\n  expected: ${expected}\n  actual:   ${hash}`)
  }
  log(`SHA-256 verified: ${hash}`)
}

function extractTarball(archivePath: string, destDir: string): void {
  mkdirSync(destDir, { recursive: true })
  log(`extracting ${archivePath} → ${destDir}`)
  const result = spawnSync('tar', ['-xzf', archivePath, '-C', destDir], { stdio: 'inherit' })
  if (result.status !== 0) {
    fail(`tar extraction failed with exit code ${result.status}`)
  }
  log('extraction complete')
}

async function runFromArchive(url: string, expectedShaArg: string | undefined): Promise<void> {
  if (targetHasPayload() && !force) {
    fail(`target already contains a runtime payload: ${TARGET_DIR}\nRe-run with --force to replace it.`)
  }
  const tmpFile = join(tmpdir(), `rox-design-payload-${Date.now()}.tar.gz`)
  try {
    await downloadArchive(url, tmpFile)
    if (expectedShaArg) {
      verifySha256(tmpFile, expectedShaArg)
    } else {
      log('warning: --expected-sha256 not provided; skipping integrity verification')
    }
    clearTarget()
    extractTarball(tmpFile, TARGET_DIR)
    const { version } = validateTargetAfterExtract()
    writeFileSync(join(TARGET_DIR, 'MANIFEST.json'), `${JSON.stringify({
      schema: 'rox-design-runtime-manifest.v1',
      mode: 'from-archive',
      archiveUrl: url,
      archiveSha256: expectedShaArg ?? null,
      version,
      copiedAt: new Date().toISOString(),
      copiedPaths: COPY_PATHS,
    }, null, 2)}\n`)
    log(`prepared Open Design ${version} runtime at ${TARGET_DIR} (from archive)`)
    log('payload is gitignored; build artifacts pick it up through electron-builder resources.')
  } finally {
    try { rmSync(tmpFile, { force: true }) } catch { /* ignore */ }
  }
}

function runFromSourceResources(): void {
  const { version } = validateSource()
  if (checkOnly) {
    log(`source ok: ${sourceRoot}`)
    log(`Open Design version: ${version}`)
    log(`target: ${TARGET_DIR}`)
    process.exit(0)
  }
  if (targetHasPayload() && !force) {
    fail(`target already contains a runtime payload: ${TARGET_DIR}\nRe-run with --force to replace it.`)
  }
  clearTarget()
  for (const relativePath of COPY_PATHS) {
    const from = join(sourceRoot, relativePath)
    const to = join(TARGET_DIR, relativePath)
    mkdirSync(dirname(to), { recursive: true })
    cpSync(from, to, { recursive: true, force: true, dereference: true })
    log(`copied ${relativePath}`)
  }
  writeFileSync(join(TARGET_DIR, 'MANIFEST.json'), `${JSON.stringify({
    schema: 'rox-design-runtime-manifest.v1',
    mode: 'source-resources',
    sourceRoot,
    version,
    copiedAt: new Date().toISOString(),
    copiedPaths: COPY_PATHS,
  }, null, 2)}\n`)
  log(`prepared Open Design ${version} runtime at ${TARGET_DIR}`)
  log('payload is gitignored; build artifacts pick it up through electron-builder resources.')
}

if (fromArchive) {
  if (checkOnly) {
    log(`--check is not supported with --from-archive; nothing to validate without downloading`)
    process.exit(0)
  }
  await runFromArchive(fromArchive, expectedSha)
} else {
  runFromSourceResources()
}
