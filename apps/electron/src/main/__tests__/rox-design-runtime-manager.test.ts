import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
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
  const dir = mkdtempSync(join(tmpdir(), 'rox-design-runtime-'))
  tempRoots.push(dir)
  return dir
}

function createMockOpenDesignRuntime(resourcesRoot: string): string {
  const runtimeRoot = join(resourcesRoot, 'resources', 'rox-design')
  const daemonDir = join(runtimeRoot, 'app', 'prebundled', 'daemon')
  mkdirSync(daemonDir, { recursive: true })
  mkdirSync(join(runtimeRoot, 'open-design'), { recursive: true })
  mkdirSync(join(runtimeRoot, 'open-design-web-standalone'), { recursive: true })

  const sidecarScript = `
const appFlagIndex = process.argv.indexOf('--od-stamp-app')
const app = appFlagIndex === -1 ? 'unknown' : process.argv[appFlagIndex + 1]
const port = app === 'daemon' ? 49111 : 49112
process.stdout.write(JSON.stringify({ pid: process.pid, state: 'running', url: 'http://127.0.0.1:' + port }) + '\\n')
setInterval(() => {}, 1000)
process.on('SIGTERM', () => process.exit(0))
`
  writeFileSync(join(daemonDir, 'daemon-sidecar.mjs'), sidecarScript)
  writeFileSync(join(daemonDir, 'daemon-cli.mjs'), 'process.exit(0)\n')
  writeFileSync(join(runtimeRoot, 'app', 'prebundled', 'web-sidecar.mjs'), sidecarScript)
  writeFileSync(join(runtimeRoot, 'open-design-config.json'), JSON.stringify({
    appVersion: '0.7-test',
    daemonCliEntryRelative: 'app/prebundled/daemon/daemon-cli.mjs',
    daemonSidecarEntryRelative: 'app/prebundled/daemon/daemon-sidecar.mjs',
    nodeCommandRelative: 'open-design/bin/node',
    webOutputMode: 'standalone',
    webSidecarEntryRelative: 'app/prebundled/web-sidecar.mjs',
  }))

  const nodeShim = join(runtimeRoot, 'open-design', 'bin', 'node')
  mkdirSync(join(runtimeRoot, 'open-design', 'bin'), { recursive: true })
  writeFileSync(nodeShim, `#!/usr/bin/env sh\nexec "${process.execPath}" "$@"\n`)
  chmodSync(nodeShim, 0o755)
  return runtimeRoot
}

function createMockOpenDesignRuntimeWithExit(resourcesRoot: string, exitAfterMs: number): string {
  const runtimeRoot = join(resourcesRoot, 'resources', 'rox-design')
  const daemonDir = join(runtimeRoot, 'app', 'prebundled', 'daemon')
  mkdirSync(daemonDir, { recursive: true })
  mkdirSync(join(runtimeRoot, 'open-design'), { recursive: true })
  mkdirSync(join(runtimeRoot, 'open-design-web-standalone'), { recursive: true })

  const sidecarScript = `
const appFlagIndex = process.argv.indexOf('--od-stamp-app')
const app = appFlagIndex === -1 ? 'unknown' : process.argv[appFlagIndex + 1]
const port = app === 'daemon' ? 49113 : 49114
process.stdout.write(JSON.stringify({ pid: process.pid, state: 'running', url: 'http://127.0.0.1:' + port }) + '\\n')
setTimeout(() => process.exit(42), ${exitAfterMs})
process.on('SIGTERM', () => process.exit(0))
`
  writeFileSync(join(daemonDir, 'daemon-sidecar.mjs'), sidecarScript)
  writeFileSync(join(daemonDir, 'daemon-cli.mjs'), 'process.exit(0)\n')
  writeFileSync(join(runtimeRoot, 'app', 'prebundled', 'web-sidecar.mjs'), sidecarScript)
  writeFileSync(join(runtimeRoot, 'open-design-config.json'), JSON.stringify({
    appVersion: '0.7-crash-test',
    daemonCliEntryRelative: 'app/prebundled/daemon/daemon-cli.mjs',
    daemonSidecarEntryRelative: 'app/prebundled/daemon/daemon-sidecar.mjs',
    nodeCommandRelative: 'open-design/bin/node',
    webOutputMode: 'standalone',
    webSidecarEntryRelative: 'app/prebundled/web-sidecar.mjs',
  }))

  const nodeShim = join(runtimeRoot, 'open-design', 'bin', 'node')
  mkdirSync(join(runtimeRoot, 'open-design', 'bin'), { recursive: true })
  writeFileSync(nodeShim, `#!/usr/bin/env sh\nexec "${process.execPath}" "$@"\n`)
  chmodSync(nodeShim, 0o755)
  return runtimeRoot
}

afterEach(() => {
  for (const dir of tempRoots.splice(0)) rmSync(dir, { recursive: true, force: true })
  delete process.env.ROX_DESIGN_WEB_URL
  delete process.env.ROX_DESIGN_RUNTIME_ROOT
  mockSend.mockClear()
})

describe('RoxDesignRuntimeManager', () => {
  test('reports a recoverable failure when bundled Open Design runtime is absent', async () => {
    const manager = new RoxDesignRuntimeManager({ resourcesRoot: tempRoot() })

    const status = await manager.start()

    expect(status.status).toBe('failed')
    expect(status.webUrl).toBeUndefined()
    expect(status.error).toContain('Rox Design runtime is not bundled')
  })


  test('reports a recoverable failure when bundled runtime files are incomplete', async () => {
    const resourcesRoot = tempRoot()
    const runtimeRoot = join(resourcesRoot, 'resources', 'rox-design')
    mkdirSync(runtimeRoot, { recursive: true })
    writeFileSync(join(runtimeRoot, 'open-design-config.json'), JSON.stringify({ appVersion: 'broken' }))
    const manager = new RoxDesignRuntimeManager({ resourcesRoot })

    const status = await manager.start()

    expect(status.status).toBe('failed')
    expect(status.error).toContain('runtime bundle is incomplete')
    expect(status.error).toContain('Open Design node runtime')
  })

  test('uses an explicit development web URL without spawning a second app', async () => {
    process.env.ROX_DESIGN_WEB_URL = 'https://rox-design-dev.t'
    const manager = new RoxDesignRuntimeManager({ resourcesRoot: tempRoot() })

    const status = await manager.start()

    expect(status).toMatchObject({
      status: 'running',
      webUrl: 'https://rox-design-dev.t?embed=rox&theme=system&lang=ru',
      version: 'dev',
    })
  })

  test('starts bundled Open Design daemon and web sidecars when resources are present', async () => {
    const resourcesRoot = tempRoot()
    createMockOpenDesignRuntime(resourcesRoot)
    const manager = new RoxDesignRuntimeManager({ resourcesRoot, dataRoot: join(resourcesRoot, 'data') })

    const status = await manager.start()

    expect(status).toMatchObject({
      status: 'running',
      daemonUrl: 'http://127.0.0.1:49111',
      webUrl: 'http://127.0.0.1:49112?embed=rox&theme=system&lang=ru',
      version: '0.7-test',
    })

    await expect(manager.stop()).resolves.toMatchObject({ status: 'idle' })
  })

  test('can start from an explicit Open Design runtime root', async () => {
    const resourcesRoot = tempRoot()
    const runtimeRoot = createMockOpenDesignRuntime(resourcesRoot)
    process.env.ROX_DESIGN_RUNTIME_ROOT = runtimeRoot
    const manager = new RoxDesignRuntimeManager({ resourcesRoot: tempRoot(), dataRoot: join(resourcesRoot, 'data') })

    const status = await manager.start()

    expect(status.status).toBe('running')
    expect(status.version).toBe('0.7-test')

    await manager.stop()
  })

  test('concurrent start() calls share a single in-flight promise', async () => {
    const resourcesRoot = tempRoot()
    createMockOpenDesignRuntime(resourcesRoot)
    const manager = new RoxDesignRuntimeManager({ resourcesRoot, dataRoot: join(resourcesRoot, 'data') })

    // Fire 3 concurrent start() calls before any can complete
    const calls: Array<Promise<import('../../shared/types').RoxDesignStatus>> = [
      manager.start(), manager.start(), manager.start(),
    ]
    const results = await Promise.all(calls)

    // All 3 must resolve to the same final running status (not 'starting')
    expect(results[0]).toEqual(results[1])
    expect(results[1]).toEqual(results[2])
    expect(results[0].status).toBe('running')

    await manager.stop()
  })

  test('notifies renderer via IPC when sidecar exits post-startup', async () => {
    const resourcesRoot = tempRoot()
    createMockOpenDesignRuntimeWithExit(resourcesRoot, 200)
    const manager = new RoxDesignRuntimeManager({ resourcesRoot, dataRoot: join(resourcesRoot, 'data') })

    const status = await manager.start()
    expect(status.status).toBe('running')

    // Wait for the sidecar to exit naturally
    await new Promise((resolve) => setTimeout(resolve, 800))

    expect(mockSend).toHaveBeenCalledWith(
      'rox-design:sidecar-exited',
      expect.objectContaining({ reason: expect.any(String) }),
    )
  })

  // C-H2: stopping flag must suppress rox-design:sidecar-exited during intentional stop()
  test('does NOT emit rox-design:sidecar-exited IPC when stop() kills the sidecars (C-H2)', async () => {
    const resourcesRoot = tempRoot()
    createMockOpenDesignRuntime(resourcesRoot)
    const manager = new RoxDesignRuntimeManager({ resourcesRoot, dataRoot: join(resourcesRoot, 'data') })

    const status = await manager.start()
    expect(status.status).toBe('running')

    mockSend.mockClear()
    await manager.stop()

    // Allow any deferred microtasks/timers to fire
    await new Promise((resolve) => setTimeout(resolve, 100))

    const sidecarExitedCalls = mockSend.mock.calls.filter(([channel]) => channel === 'rox-design:sidecar-exited')
    expect(sidecarExitedCalls).toHaveLength(0)
  })

  // C-H2: crash path must still emit rox-design:sidecar-exited (existing behaviour preserved)
  test('emits rox-design:sidecar-exited IPC when sidecar crashes without stop() (C-H2 baseline)', async () => {
    const resourcesRoot = tempRoot()
    createMockOpenDesignRuntimeWithExit(resourcesRoot, 150)
    const manager = new RoxDesignRuntimeManager({ resourcesRoot, dataRoot: join(resourcesRoot, 'data') })

    const status = await manager.start()
    expect(status.status).toBe('running')

    // Wait for natural crash
    await new Promise((resolve) => setTimeout(resolve, 700))

    expect(mockSend).toHaveBeenCalledWith(
      'rox-design:sidecar-exited',
      expect.objectContaining({ reason: expect.any(String) }),
    )
  })
})
