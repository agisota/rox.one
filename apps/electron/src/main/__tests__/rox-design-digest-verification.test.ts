/**
 * B-H2: per-file SHA-256 digest verification at runtime launch.
 *
 * With asar:false the payload sits as unpacked files on disk. Without digest
 * verification a tampered .mjs file would run with full Electron permissions.
 * RoxDesignRuntimeManager.start() must fail closed when any digest mismatches.
 */
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { createHash } from 'crypto'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, mock, test } from 'bun:test'

const mockSend = mock((_channel: string, _payload: unknown) => undefined)
mock.module('electron', () => ({
  BrowserWindow: {
    getAllWindows: () => [{ webContents: { send: mockSend } }],
  },
  dialog: {
    showOpenDialog: mock(async () => ({ canceled: true, filePaths: [] })),
  },
  shell: {
    openExternal: mock(async () => undefined),
    openPath: mock(async () => ''),
  },
}))

const { RoxDesignRuntimeManager } = await import('../rox-design-runtime-manager') as typeof import('../rox-design-runtime-manager')

const tempRoots: string[] = []

function tempRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), 'rox-b-h2-test-'))
  tempRoots.push(dir)
  return dir
}

function sha256Hex(content: string): string {
  return createHash('sha256').update(content).digest('hex')
}

/**
 * Builds a minimal mock runtime in `resourcesRoot/resources/rox-design` with a
 * MANIFEST.json that has a `fileDigests` block covering the sidecar entry points.
 * Returns { runtimeRoot, digestedPaths } for further manipulation in tests.
 */
function createMockRuntimeWithDigests(resourcesRoot: string): {
  runtimeRoot: string
  daemonSidecarPath: string
  daemonCliPath: string
  webSidecarPath: string
} {
  const runtimeRoot = join(resourcesRoot, 'resources', 'rox-design')
  const daemonDir = join(runtimeRoot, 'app', 'prebundled', 'daemon')
  mkdirSync(daemonDir, { recursive: true })
  mkdirSync(join(runtimeRoot, 'open-design', 'bin'), { recursive: true })
  mkdirSync(join(runtimeRoot, 'open-design-web-standalone', 'apps', 'web'), { recursive: true })

  const sidecarScript = `\
const appFlagIndex = process.argv.indexOf('--od-stamp-app')
const app = appFlagIndex === -1 ? 'unknown' : process.argv[appFlagIndex + 1]
const port = app === 'daemon' ? 49211 : 49212
process.stdout.write(JSON.stringify({ pid: process.pid, state: 'running', url: 'http://127.0.0.1:' + port }) + '\\n')
setInterval(() => {}, 1000)
process.on('SIGTERM', () => process.exit(0))
`
  const daemonSidecarPath = join(daemonDir, 'daemon-sidecar.mjs')
  const daemonCliPath = join(daemonDir, 'daemon-cli.mjs')
  const webSidecarPath = join(runtimeRoot, 'app', 'prebundled', 'web-sidecar.mjs')
  const nodeBinPath = join(runtimeRoot, 'open-design', 'bin', 'node')
  const serverJsPath = join(runtimeRoot, 'open-design-web-standalone', 'apps', 'web', 'server.js')

  const daemonCliContent = 'process.exit(0)\n'
  const nodeBinContent = `#!/usr/bin/env sh\nexec "${process.execPath}" "$@"\n`
  const serverJsContent = '// placeholder\n'

  writeFileSync(daemonSidecarPath, sidecarScript)
  writeFileSync(daemonCliPath, daemonCliContent)
  writeFileSync(webSidecarPath, sidecarScript)
  writeFileSync(nodeBinPath, nodeBinContent)
  writeFileSync(serverJsPath, serverJsContent)
  chmodSync(nodeBinPath, 0o755)

  writeFileSync(join(runtimeRoot, 'open-design-config.json'), JSON.stringify({
    appVersion: '0.7-b-h2-test',
    daemonCliEntryRelative: 'app/prebundled/daemon/daemon-cli.mjs',
    daemonSidecarEntryRelative: 'app/prebundled/daemon/daemon-sidecar.mjs',
    nodeCommandRelative: 'open-design/bin/node',
    webOutputMode: 'standalone',
    webSidecarEntryRelative: 'app/prebundled/web-sidecar.mjs',
  }))

  const fileDigests: Record<string, string> = {
    'app/prebundled/daemon/daemon-sidecar.mjs': sha256Hex(sidecarScript),
    'app/prebundled/daemon/daemon-cli.mjs': sha256Hex(daemonCliContent),
    'app/prebundled/web-sidecar.mjs': sha256Hex(sidecarScript),
    'open-design/bin/node': sha256Hex(nodeBinContent),
    'open-design-web-standalone/apps/web/server.js': sha256Hex(serverJsContent),
  }

  writeFileSync(join(runtimeRoot, 'MANIFEST.json'), JSON.stringify({
    schema: 'rox-design-runtime-manifest.v1',
    version: '0.7-b-h2-test',
    copiedAt: new Date().toISOString(),
    copiedPaths: ['app/prebundled', 'open-design', 'open-design-web-standalone'],
    fileDigests,
  }, null, 2))

  return { runtimeRoot, daemonSidecarPath, daemonCliPath, webSidecarPath }
}

afterEach(() => {
  for (const dir of tempRoots.splice(0)) rmSync(dir, { recursive: true, force: true })
  delete process.env.ROX_DESIGN_WEB_URL
  delete process.env.ROX_DESIGN_RUNTIME_ROOT
  mockSend.mockClear()
})

describe('RoxDesignRuntimeManager — B-H2 digest verification', () => {
  test('starts successfully when all file digests match', async () => {
    const resourcesRoot = tempRoot()
    createMockRuntimeWithDigests(resourcesRoot)
    const manager = new RoxDesignRuntimeManager({ resourcesRoot, dataRoot: join(resourcesRoot, 'data') })

    const status = await manager.start()

    expect(status.status).toBe('running')
    expect(status.version).toBe('0.7-b-h2-test')

    await manager.stop()
  }, 20_000)

  test('fails closed with tamper-detected error when a sidecar file is modified', async () => {
    const resourcesRoot = tempRoot()
    const { daemonSidecarPath } = createMockRuntimeWithDigests(resourcesRoot)

    // Tamper: overwrite the daemon sidecar with different bytes
    writeFileSync(daemonSidecarPath, '// tampered\n')

    const manager = new RoxDesignRuntimeManager({ resourcesRoot })
    const status = await manager.start()

    expect(status.status).toBe('failed')
    expect(status.error).toContain('tamper detected')
    expect(status.error).toContain('daemon-sidecar.mjs')
    expect(status.error).toContain('digest mismatch')
  })

  test('proceeds with a warning when MANIFEST.json has no fileDigests block (backward compat)', async () => {
    const resourcesRoot = tempRoot()
    const { runtimeRoot } = createMockRuntimeWithDigests(resourcesRoot)

    // Overwrite MANIFEST without fileDigests to simulate pre-B-H2 payload
    writeFileSync(join(runtimeRoot, 'MANIFEST.json'), JSON.stringify({
      schema: 'rox-design-runtime-manifest.v1',
      version: '0.6-legacy',
      copiedAt: new Date().toISOString(),
      copiedPaths: ['app/prebundled', 'open-design', 'open-design-web-standalone'],
    }, null, 2))

    const warnings: string[] = []
    const manager = new RoxDesignRuntimeManager({
      resourcesRoot,
      dataRoot: join(resourcesRoot, 'data'),
      logger: { warn: (msg) => warnings.push(msg) },
    })

    const status = await manager.start()

    // Should still start (backward compat), just with a warning
    expect(status.status).toBe('running')
    expect(warnings.some((w) => w.includes('no fileDigests') || w.includes('tamper detection skipped'))).toBe(true)

    await manager.stop()
  }, 20_000)
})
