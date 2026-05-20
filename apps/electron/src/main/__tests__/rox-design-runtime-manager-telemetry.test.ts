/**
 * Integration test wiring RoxDesignRuntimeManager to a real telemetry
 * implementation. We mock the Electron module and the open-design runtime
 * (mirroring the existing rox-design-runtime-manager.test.ts harness),
 * then assert the telemetry pipeline emits the expected sequence.
 */
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, mock, test } from 'bun:test'

const mockSend = mock((_channel: string, _payload: unknown) => undefined)
// Defensive mock: include WebContentsView / BrowserView / ipcMain so any test
// file that runs after this one within the same bun process can still load
// the view manager. mock.module is process-global in bun; minimal stubs
// keep imports resolving even if subsequent files don't redefine them.
class _NoopElectronView {
  webContents = { id: 0, isDestroyed: () => false }
  setBounds(_b: unknown) {}
  setVisible(_v: boolean) {}
  setBackgroundColor(_c: string) {}
}
mock.module('electron', () => ({
  BrowserWindow: {
    getAllWindows: () => [{ webContents: { send: mockSend } }],
  },
  BrowserView: _NoopElectronView,
  WebContentsView: _NoopElectronView,
  ipcMain: { handle: () => undefined, on: () => undefined },
  dialog: {
    showOpenDialog: mock(async () => ({ canceled: true, filePaths: [] })),
  },
  shell: {
    openExternal: mock(async () => undefined),
    openPath: mock(async () => ''),
  },
}))

const { RoxDesignRuntimeManager } = await import('../rox-design-runtime-manager') as typeof import('../rox-design-runtime-manager')
const { createRoxDesignTelemetry } = await import('../rox-design-telemetry') as typeof import('../rox-design-telemetry')
type RoxDesignTelemetryRecord = import('../rox-design-telemetry').RoxDesignTelemetryRecord

const tempRoots: string[] = []

function tempRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), 'rox-design-runtime-tel-'))
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
const port = app === 'daemon' ? 49211 : 49212
process.stdout.write(JSON.stringify({ pid: process.pid, state: 'running', url: 'http://127.0.0.1:' + port }) + '\\n')
setInterval(() => {}, 1000)
process.on('SIGTERM', () => process.exit(0))
`
  writeFileSync(join(daemonDir, 'daemon-sidecar.mjs'), sidecarScript)
  writeFileSync(join(daemonDir, 'daemon-cli.mjs'), 'process.exit(0)\n')
  writeFileSync(join(runtimeRoot, 'app', 'prebundled', 'web-sidecar.mjs'), sidecarScript)
  writeFileSync(join(runtimeRoot, 'open-design-config.json'), JSON.stringify({
    appVersion: '0.7-perf-test',
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

describe('RoxDesignRuntimeManager + telemetry integration', () => {
  test('emits spawn-sidecar and register-desktop-auth phase records during cold start', async () => {
    const records: RoxDesignTelemetryRecord[] = []
    const telemetry = createRoxDesignTelemetry({
      sink: { emit: (r) => records.push(r) },
      platform: 'linux',
      arch: 'x64',
    })

    const resourcesRoot = tempRoot()
    createMockOpenDesignRuntime(resourcesRoot)

    const showSpan = telemetry.startShow()

    const manager = new RoxDesignRuntimeManager({
      resourcesRoot,
      dataRoot: join(resourcesRoot, 'data'),
      startupPhaseHook: showSpan,
    })

    const status = await manager.start()
    expect(status.status).toBe('running')
    showSpan.end()

    const phases = records.filter((r) => r.phase != null).map((r) => r.phase)
    expect(phases).toContain('spawn-sidecar')
    expect(phases).toContain('register-desktop-auth')
    // spawn-sidecar must precede register-desktop-auth in the stream.
    expect(phases.indexOf('spawn-sidecar')).toBeLessThan(phases.indexOf('register-desktop-auth'))

    const total = records.find((r) => r.event === 'first-show' && r.phase == null)
    expect(total).toBeDefined()
    expect(total!.cold).toBe(true)

    await manager.stop()
  })
})
