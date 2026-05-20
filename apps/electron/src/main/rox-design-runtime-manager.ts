import { spawn, type ChildProcessByStdio } from 'child_process'
import { randomBytes } from 'crypto'
import { createConnection } from 'net'
import { existsSync, readFileSync } from 'fs'
import { mkdir, mkdtemp, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { dirname, isAbsolute, join, resolve } from 'path'
import type { Readable } from 'stream'
import { BrowserWindow } from 'electron'
import type { RoxDesignStatus } from '../shared/types'

export interface RoxDesignRuntimeManagerOptions {
  resourcesRoot: string
  dataRoot?: string
  logger?: {
    info?: (message: string, meta?: Record<string, unknown>) => void
    warn?: (message: string, meta?: Record<string, unknown>) => void
    error?: (message: string, meta?: Record<string, unknown>) => void
  }
}

interface OpenDesignConfig {
  appVersion?: string
  daemonCliEntryRelative?: string
  daemonSidecarEntryRelative?: string
  namespace?: string
  nodeCommandRelative?: string
  webOutputMode?: string
  webSidecarEntryRelative?: string
}

interface OpenDesignRuntimeLayout {
  root: string
  config: OpenDesignConfig
  version: string
  nodePath: string
  daemonEntryPath: string
  daemonCliPath: string
  webEntryPath: string
  resourceRoot: string
  standaloneRoot: string
}

type SidecarChild = ChildProcessByStdio<null, Readable, Readable>

interface ManagedProcess {
  app: 'daemon' | 'web'
  child: SidecarChild
}

interface SidecarStatus {
  pid?: number
  state?: string
  url?: string | null
  updatedAt?: string
  desktopAuthGateActive?: boolean
}

const EMBED_PARAMS: Record<string, string> = {
  embed: 'rox',
  theme: 'system',
  lang: 'ru',
}

const SIDECAR_START_TIMEOUT_MS = 45_000
const SIDECAR_STOP_TIMEOUT_MS = 5_000
const REGISTER_DESKTOP_AUTH_TIMEOUT_MS = 800
const REGISTER_DESKTOP_AUTH_RETRY_DELAYS_MS = [120, 240, 480, 960, 1500] as const

function withRoxEmbedParams(rawUrl: string): string {
  // Validate without using URL#toString() for output: it normalizes bare hosts
  // to a trailing slash, while the renderer tests and env examples preserve the
  // operator-provided origin exactly.
  new URL(rawUrl)

  const [withoutHash, hash = ''] = rawUrl.split('#', 2)
  const [base, query = ''] = withoutHash.split('?', 2)
  const params = new URLSearchParams(query)
  for (const [key, value] of Object.entries(EMBED_PARAMS)) {
    params.set(key, value)
  }
  const search = params.toString()
  return `${base}${search ? `?${search}` : ''}${hash ? `#${hash}` : ''}`
}

function resolveInside(base: string, relativePath: string): string {
  return isAbsolute(relativePath) ? relativePath : join(base, relativePath)
}

function readOpenDesignConfig(root: string): OpenDesignConfig | null {
  const configPath = join(root, 'open-design-config.json')
  if (!existsSync(configPath)) return null

  const parsed = JSON.parse(readFileSync(configPath, 'utf8')) as OpenDesignConfig
  return parsed
}

function requireExistingFile(path: string, label: string): void {
  if (!existsSync(path)) throw new Error(`${label} is missing at ${path}`)
}

function parsePort(url: string): string {
  const parsed = new URL(url)
  if (!parsed.port) throw new Error(`sidecar URL does not include a port: ${url}`)
  return parsed.port
}

async function createIpcBase(): Promise<string> {
  if (process.platform === 'win32') {
    return await mkdtemp(join(tmpdir(), 'rox-design-ipc-'))
  }

  // Unix domain sockets have a small path-length limit on macOS. `/tmp` keeps
  // Open Design sidecar socket paths short enough for packaged app names.
  const base = join('/tmp', `roxod-${process.pid}-${Date.now().toString(36)}`)
  await mkdir(base, { recursive: true })
  return base
}

function sidecarStampArgs(app: 'daemon' | 'web', namespace: string, ipcPath: string): string[] {
  return [
    '--od-stamp-app', app,
    '--od-stamp-mode', 'runtime',
    '--od-stamp-namespace', namespace,
    '--od-stamp-ipc', ipcPath,
    '--od-stamp-source', 'packaged',
  ]
}

function extractFirstJsonObject(buffer: string): string | null {
  const start = buffer.indexOf('{')
  if (start === -1) return null

  let depth = 0
  let inString = false
  let escaped = false

  for (let index = start; index < buffer.length; index += 1) {
    const char = buffer[index]

    if (inString) {
      if (escaped) {
        escaped = false
      } else if (char === '\\') {
        escaped = true
      } else if (char === '"') {
        inString = false
      }
      continue
    }

    if (char === '"') {
      inString = true
    } else if (char === '{') {
      depth += 1
    } else if (char === '}') {
      depth -= 1
      if (depth === 0) return buffer.slice(start, index + 1)
    }
  }

  return null
}

function waitForSidecarStatus(processHandle: ManagedProcess, timeoutMs = SIDECAR_START_TIMEOUT_MS): Promise<SidecarStatus> {
  return new Promise((resolveStatus, rejectStatus) => {
    let stdout = ''
    let stderr = ''
    let settled = false

    const settle = (callback: () => void) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      callback()
    }

    const timer = setTimeout(() => {
      settle(() => rejectStatus(new Error(`${processHandle.app} sidecar did not report status within ${timeoutMs}ms${stderr ? `: ${stderr.slice(-500)}` : ''}`)))
    }, timeoutMs)
    timer.unref?.()

    processHandle.child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8')
      const json = extractFirstJsonObject(stdout)
      if (!json) return

      try {
        const parsed = JSON.parse(json) as SidecarStatus
        settle(() => resolveStatus(parsed))
      } catch (error) {
        settle(() => rejectStatus(error instanceof Error ? error : new Error(String(error))))
      }
    })

    processHandle.child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8')
    })

    processHandle.child.once('error', (error) => {
      settle(() => rejectStatus(error))
    })

    processHandle.child.once('exit', (code, signal) => {
      if (settled) return
      settle(() => rejectStatus(new Error(`${processHandle.app} sidecar exited before reporting status (code=${code ?? 'null'}, signal=${signal ?? 'null'})${stderr ? `: ${stderr.slice(-500)}` : ''}`)))
    })
  })
}


async function requestJsonIpc(socketPath: string, payload: unknown, timeoutMs = 1500): Promise<unknown> {
  return await new Promise((resolveRequest, rejectRequest) => {
    const socket = createConnection(socketPath)
    let settled = false
    let buffer = ''

    const settle = (callback: () => void) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      callback()
    }

    const timeout = setTimeout(() => {
      socket.destroy()
      settle(() => rejectRequest(new Error(`IPC request timed out: ${socketPath}`)))
    }, timeoutMs)
    timeout.unref?.()

    socket.on('connect', () => {
      socket.write(`${JSON.stringify(payload)}\n`)
    })

    socket.on('data', (chunk: Buffer) => {
      buffer += chunk.toString('utf8')
      const newlineIndex = buffer.indexOf('\n')
      if (newlineIndex < 0) return
      socket.end()
      settle(() => {
        const response = JSON.parse(buffer.slice(0, newlineIndex)) as { ok?: boolean; result?: unknown; error?: { message?: string } }
        if (!response.ok) {
          rejectRequest(new Error(response.error?.message ?? 'IPC request failed'))
          return
        }
        resolveRequest(response.result)
      })
    })

    socket.on('error', (error) => {
      settle(() => rejectRequest(error))
    })
  })
}

async function stopChild(child: SidecarChild): Promise<void> {
  if (child.exitCode != null || child.signalCode != null) return

  await new Promise<void>((resolveStop) => {
    const timer = setTimeout(() => {
      if (child.exitCode == null && child.signalCode == null) child.kill('SIGKILL')
    }, SIDECAR_STOP_TIMEOUT_MS)
    timer.unref?.()

    child.once('exit', () => {
      clearTimeout(timer)
      resolveStop()
    })

    child.kill('SIGTERM')
  })
}

// Single-slot queue so renderer doesn't miss a crash event that fires before
// it subscribes. Holds at most one payload; cleared on first delivery.
interface SidecarExitedPayload {
  reason: string
  code: number | null
}

export class RoxDesignRuntimeManager {
  private status: RoxDesignStatus = { status: 'idle' }
  private readonly resourcesRoot: string
  private readonly dataRoot?: string
  private readonly logger: RoxDesignRuntimeManagerOptions['logger']
  private processes: ManagedProcess[] = []
  private ipcBase: string | null = null
  private daemonIpcPath: string | null = null
  private desktopAuthSecret: Buffer | null = null
  private startPromise: Promise<RoxDesignStatus> | null = null
  private pendingSidecarExitEvent: SidecarExitedPayload | null = null
  // C-H2 (audit 2026-05-20-pr268-release-readiness-audit): guards the
  // child.once('exit') handler from emitting rox-design:sidecar-exited IPC
  // during an intentional stop(). Without this flag the stop() kill races the
  // exit handler and the renderer incorrectly treats a clean shutdown as a
  // crash. See also: PR #268 follow-up d1ea1854 that introduced the handler.
  private stopping = false

  constructor(options: RoxDesignRuntimeManagerOptions) {
    this.resourcesRoot = options.resourcesRoot
    this.dataRoot = options.dataRoot
    this.logger = options.logger
  }

  getStatus(): RoxDesignStatus {
    return { ...this.status }
  }

  getDesktopBridgeContext(): { daemonUrl?: string; desktopAuthSecret?: Buffer; registerDesktopAuthWithDaemon?: () => Promise<boolean> } {
    return {
      daemonUrl: this.status.daemonUrl,
      desktopAuthSecret: this.desktopAuthSecret ?? undefined,
      registerDesktopAuthWithDaemon: () => this.registerDesktopAuthWithDaemon(),
    }
  }

  async start(): Promise<RoxDesignStatus> {
    if (this.status.status === 'running') return this.getStatus()
    if (this.startPromise) return this.startPromise

    this.status = { status: 'starting' }
    this.broadcastStatus()
    this.startPromise = this._doStart().finally(() => {
      this.startPromise = null
    })
    return this.startPromise
  }

  private async _doStart(): Promise<RoxDesignStatus> {
    const explicitWebUrl = process.env.ROX_DESIGN_WEB_URL?.trim()
    if (explicitWebUrl) {
      try {
        this.status = {
          status: 'running',
          webUrl: withRoxEmbedParams(explicitWebUrl),
          version: process.env.ROX_DESIGN_VERSION?.trim() || 'dev',
        }
        this.logger?.info?.('[rox-design] using explicit web URL', { webUrl: this.status.webUrl })
        this.broadcastStatus()
        return this.getStatus()
      } catch (error) {
        this.status = {
          status: 'failed',
          error: `Invalid ROX_DESIGN_WEB_URL: ${error instanceof Error ? error.message : String(error)}`,
        }
        this.broadcastStatus()
        return this.getStatus()
      }
    }

    let bundledLayout: OpenDesignRuntimeLayout | null = null
    try {
      bundledLayout = this.findBundledRuntimeLayout()
    } catch (error) {
      this.status = {
        status: 'failed',
        error: `Rox Design runtime bundle is incomplete: ${error instanceof Error ? error.message : String(error)}`,
      }
      this.logger?.error?.('[rox-design] bundled runtime bundle is incomplete', { error: this.status.error })
      this.broadcastStatus()
      return this.getStatus()
    }

    if (!bundledLayout) {
      this.status = {
        status: 'failed',
        error: `Rox Design runtime is not bundled yet. Expected Open Design resources under ${join(this.resourcesRoot, 'resources', 'rox-design')}.`,
      }
      this.logger?.warn?.('[rox-design] bundled runtime missing', { resourcesRoot: this.resourcesRoot })
      this.broadcastStatus()
      return this.getStatus()
    }

    try {
      const started = await this.startBundledRuntime(bundledLayout)
      this.status = started
      this.broadcastStatus()
      return this.getStatus()
    } catch (error) {
      await this.stopProcesses()
      this.status = {
        status: 'failed',
        error: `Rox Design runtime failed to start: ${error instanceof Error ? error.message : String(error)}`,
      }
      this.logger?.error?.('[rox-design] bundled runtime failed to start', { error: this.status.error })
      this.broadcastStatus()
      return this.getStatus()
    }
  }

  async stop(): Promise<RoxDesignStatus> {
    // C-H2: set before kill so the exit handler short-circuits.
    this.stopping = true
    await this.stopProcesses()
    // Reset so a subsequent start()+stop() cycle works correctly.
    this.stopping = false
    this.status = { status: 'idle' }
    this.broadcastStatus()
    return this.getStatus()
  }

  private broadcastStatus(): void {
    const status = this.getStatus()
    const windows = BrowserWindow.getAllWindows()
    for (const win of windows) {
      if (!(win.isDestroyed?.() ?? false)) {
        win.webContents.send('rox-design:status-changed', status)
      }
    }
  }

  private findBundledRuntimeLayout(): OpenDesignRuntimeLayout | null {
    const explicitRoot = process.env.ROX_DESIGN_RUNTIME_ROOT?.trim()
    const unpackedResourcesRoot = `${this.resourcesRoot}.asar.unpacked`
    const candidates = [
      ...(explicitRoot ? [explicitRoot] : []),
      this.resourcesRoot,
      join(this.resourcesRoot, 'resources', 'rox-design'),
      join(this.resourcesRoot, 'rox-design'),
      join(unpackedResourcesRoot, 'resources', 'rox-design'),
      join(dirname(this.resourcesRoot), 'rox-design'),
    ]

    for (const candidate of Array.from(new Set(candidates.map((value) => resolve(value))))) {
      const config = readOpenDesignConfig(candidate)
      if (!config) continue

      const layout: OpenDesignRuntimeLayout = {
        root: candidate,
        config,
        version: config.appVersion?.trim() || process.env.ROX_DESIGN_VERSION?.trim() || 'bundled',
        nodePath: resolveInside(candidate, config.nodeCommandRelative || 'open-design/bin/node'),
        daemonEntryPath: resolveInside(candidate, config.daemonSidecarEntryRelative || 'app/prebundled/daemon/daemon-sidecar.mjs'),
        daemonCliPath: resolveInside(candidate, config.daemonCliEntryRelative || 'app/prebundled/daemon/daemon-cli.mjs'),
        webEntryPath: resolveInside(candidate, config.webSidecarEntryRelative || 'app/prebundled/web-sidecar.mjs'),
        resourceRoot: join(candidate, 'open-design'),
        standaloneRoot: join(candidate, 'open-design-web-standalone'),
      }

      requireExistingFile(layout.nodePath, 'Open Design node runtime')
      requireExistingFile(layout.daemonEntryPath, 'Open Design daemon sidecar')
      requireExistingFile(layout.daemonCliPath, 'Open Design daemon CLI')
      requireExistingFile(layout.webEntryPath, 'Open Design web sidecar')
      return layout
    }

    return null
  }

  private async startBundledRuntime(layout: OpenDesignRuntimeLayout): Promise<RoxDesignStatus> {
    this.ipcBase = await createIpcBase()
    const namespace = `rx${process.pid}`
    const ipcDir = join(this.ipcBase, namespace)
    await mkdir(ipcDir, { recursive: true })
    const daemonIpcPath = join(ipcDir, 'daemon.sock')
    const webIpcPath = join(ipcDir, 'web.sock')
    this.daemonIpcPath = daemonIpcPath
    this.desktopAuthSecret = randomBytes(32)
    const commonEnv: NodeJS.ProcessEnv = {
      ...process.env,
      OD_TOOLS_DEV_PARENT_PID: String(process.pid),
      OD_SIDECAR_IPC_BASE: this.ipcBase,
      OD_SIDECAR_NAMESPACE: namespace,
      OD_SIDECAR_SOURCE: 'packaged',
      OD_DAEMON_CLI_PATH: layout.daemonCliPath,
      OD_RESOURCE_ROOT: layout.resourceRoot,
      OD_DATA_DIR: this.dataRoot ?? join(tmpdir(), 'rox-design-data'),
    }

    const daemon = this.spawnSidecar('daemon', layout.nodePath, layout.daemonEntryPath, sidecarStampArgs('daemon', namespace, daemonIpcPath), {
      ...commonEnv,
      OD_PORT: '0',
    }, layout.root)
    const daemonStatus = await waitForSidecarStatus(daemon)
    if (!daemonStatus.url) throw new Error('daemon sidecar did not provide a URL')
    const registeredDesktopAuth = await this.registerDesktopAuthWithDaemon()
    if (!registeredDesktopAuth) {
      this.logger?.warn?.('[rox-design] desktop import-token handshake with daemon did not complete; first folder import will retry')
    }
    const daemonPort = parsePort(daemonStatus.url)

    const web = this.spawnSidecar('web', layout.nodePath, layout.webEntryPath, sidecarStampArgs('web', namespace, webIpcPath), {
      ...commonEnv,
      OD_PORT: daemonPort,
      OD_WEB_PORT: '0',
      OD_WEB_OUTPUT_MODE: layout.config.webOutputMode || 'standalone',
      OD_WEB_STANDALONE_ROOT: layout.standaloneRoot,
    }, layout.root)
    const webStatus = await waitForSidecarStatus(web)
    if (!webStatus.url) throw new Error('web sidecar did not provide a URL')

    this.logger?.info?.('[rox-design] bundled runtime started', {
      root: layout.root,
      daemonUrl: daemonStatus.url,
      webUrl: webStatus.url,
      version: layout.version,
    })

    return {
      status: 'running',
      daemonUrl: daemonStatus.url,
      webUrl: withRoxEmbedParams(webStatus.url),
      version: layout.version,
    }
  }

  async registerDesktopAuthWithDaemon(): Promise<boolean> {
    if (!this.daemonIpcPath || !this.desktopAuthSecret) return false
    const message = {
      input: { secret: this.desktopAuthSecret.toString('base64') },
      type: 'register-desktop-auth',
    }

    for (let attempt = 0; attempt <= REGISTER_DESKTOP_AUTH_RETRY_DELAYS_MS.length; attempt += 1) {
      try {
        const result = await requestJsonIpc(this.daemonIpcPath, message, REGISTER_DESKTOP_AUTH_TIMEOUT_MS) as { accepted?: boolean } | null
        if (result?.accepted === true) return true
      } catch {
        // Daemon may still be wiring the desktop auth gate; retry below.
      }

      if (attempt >= REGISTER_DESKTOP_AUTH_RETRY_DELAYS_MS.length) break
      await new Promise((resolveDelay) => setTimeout(resolveDelay, REGISTER_DESKTOP_AUTH_RETRY_DELAYS_MS[attempt]))
    }

    return false
  }

  private spawnSidecar(app: 'daemon' | 'web', nodePath: string, entryPath: string, args: string[], env: NodeJS.ProcessEnv, cwd: string): ManagedProcess {
    const child = spawn(nodePath, [entryPath, ...args], {
      cwd,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    const processHandle: ManagedProcess = { app, child }
    this.processes.push(processHandle)

    child.stdout.on('data', (chunk: Buffer) => {
      this.logger?.info?.(`[rox-design:${app}:stdout] ${chunk.toString('utf8').trim()}`)
    })
    child.stderr.on('data', (chunk: Buffer) => {
      this.logger?.warn?.(`[rox-design:${app}:stderr] ${chunk.toString('utf8').trim()}`)
    })
    child.once('exit', (code, signal) => {
      this.logger?.info?.(`[rox-design:${app}] exited`, { code, signal })
      // C-H2: skip crash notification when stop() intentionally killed the
      // child — this exit is expected, not a crash.
      if (this.stopping) return
      if (this.status.status === 'running') {
        this.status = {
          status: 'failed',
          error: `Rox Design ${app} sidecar exited unexpectedly (code=${code ?? 'null'}, signal=${signal ?? 'null'}).`,
        }
        this.broadcastStatus()
        const payload: SidecarExitedPayload = {
          reason: `${app} sidecar exited unexpectedly (code=${code ?? 'null'}, signal=${signal ?? 'null'})`,
          code: typeof code === 'number' ? code : null,
        }
        const win = BrowserWindow.getAllWindows()[0]
        if (win && !(win.isDestroyed?.() ?? false)) {
          win.webContents.send('rox-design:sidecar-exited', payload)
          this.pendingSidecarExitEvent = null
        } else {
          this.pendingSidecarExitEvent = payload
        }
      }
    })

    return processHandle
  }

  private async stopProcesses(): Promise<void> {
    const processes = this.processes.splice(0).reverse()
    await Promise.allSettled(processes.map(({ child }) => stopChild(child)))

    if (this.ipcBase) {
      await rm(this.ipcBase, { recursive: true, force: true }).catch(() => undefined)
      this.ipcBase = null
    }
    this.daemonIpcPath = null
    this.desktopAuthSecret = null
  }
}
