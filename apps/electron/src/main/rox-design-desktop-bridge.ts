import { createHmac, randomBytes } from 'crypto'
import { realpath, stat } from 'fs/promises'
import { isAbsolute } from 'path'
import { BrowserWindow, dialog, shell, type WebContents } from 'electron'

export const DESKTOP_IMPORT_TOKEN_FIELD_SEP = '~'
export const DESKTOP_IMPORT_TOKEN_HEADER = 'X-OD-Desktop-Import-Token'
const DESKTOP_IMPORT_TOKEN_TTL_MS = 60_000
const PRINT_READY_TIMEOUT_MS = 30_000
const MAX_PRINT_HTML_BYTES = Number(process.env.ROX_DESIGN_MAX_PRINT_HTML_MB ?? 5) * 1024 * 1024

export interface DesktopAuthBridgeContext {
  daemonUrl?: string
  desktopAuthSecret?: Buffer
  registerDesktopAuthWithDaemon?: () => Promise<boolean>
}

export interface PickAndImportResult {
  ok: boolean
  canceled?: boolean
  reason?: string
  details?: unknown
  response?: unknown
}

interface ProjectDirContext {
  resolvedDir: string
  hasBaseDir: boolean
  fromTrustedPicker: boolean
}

export function isHttpUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

export function signDesktopImportToken(secret: Buffer, baseDir: string, options: { nonce: string; exp: string }): string {
  const signature = createHmac('sha256', secret).update(`${baseDir}\n${options.nonce}\n${options.exp}`).digest('base64url')
  return [options.nonce, options.exp, signature].join(DESKTOP_IMPORT_TOKEN_FIELD_SEP)
}

function mintImportToken(secret: Buffer, baseDir: string): string {
  const nonce = randomBytes(16).toString('base64url')
  const exp = new Date(Date.now() + DESKTOP_IMPORT_TOKEN_TTL_MS).toISOString()
  return signDesktopImportToken(secret, baseDir, { nonce, exp })
}

export function isOpenPathAllowedForProject(context: { hasBaseDir: boolean; fromTrustedPicker: boolean }): { ok: true } | { ok: false; reason: string } {
  if (context.hasBaseDir && !context.fromTrustedPicker) {
    return { ok: false, reason: 'project did not come from the trusted picker flow' }
  }
  return { ok: true }
}

export async function validateExistingDirectory(p: unknown): Promise<{ ok: true; resolved: string } | { ok: false; reason: string }> {
  if (typeof p !== 'string' || p.length === 0) return { ok: false, reason: 'path must be a non-empty string' }
  if (!isAbsolute(p)) return { ok: false, reason: 'path must be absolute' }

  let resolvedReal: string
  try {
    resolvedReal = await realpath(p)
  } catch {
    return { ok: false, reason: 'path does not exist' }
  }

  let st
  try {
    st = await stat(resolvedReal)
  } catch {
    return { ok: false, reason: "path could not be stat'd" }
  }

  if (!st.isDirectory()) return { ok: false, reason: 'path is not a directory' }
  if (resolvedReal.toLowerCase().endsWith('.app')) return { ok: false, reason: 'application bundles are not project directories' }
  return { ok: true, resolved: resolvedReal }
}

async function fetchResolvedProjectDir(apiBaseUrl: string, projectId: unknown, fetchImpl = globalThis.fetch): Promise<{ ok: true; context: ProjectDirContext } | { ok: false; reason: string }> {
  if (typeof projectId !== 'string' || projectId.length === 0) return { ok: false, reason: 'project id must be a non-empty string' }
  if (!/^[A-Za-z0-9._-]{1,128}$/.test(projectId)) return { ok: false, reason: 'project id contains disallowed characters' }

  let resp: Response
  try {
    resp = await fetchImpl(`${apiBaseUrl.replace(/\/+$/, '')}/api/projects/${encodeURIComponent(projectId)}`)
  } catch (error) {
    return { ok: false, reason: `daemon fetch failed: ${error instanceof Error ? error.message : String(error)}` }
  }
  if (!resp.ok) return { ok: false, reason: `daemon returned HTTP ${resp.status}` }

  let body: unknown
  try {
    body = await resp.json()
  } catch {
    return { ok: false, reason: 'daemon response was not JSON' }
  }

  const record = body && typeof body === 'object' ? body as Record<string, unknown> : {}
  const resolvedDir = typeof record.resolvedDir === 'string' ? record.resolvedDir : undefined
  if (!resolvedDir) return { ok: false, reason: 'daemon response did not include resolvedDir' }

  const project = record.project && typeof record.project === 'object' ? record.project as Record<string, unknown> : undefined
  const metadata = project?.metadata && typeof project.metadata === 'object' ? project.metadata as Record<string, unknown> : undefined
  const hasBaseDir = typeof metadata?.baseDir === 'string' && metadata.baseDir.length > 0
  const fromTrustedPicker = metadata?.fromTrustedPicker === true
  return { ok: true, context: { fromTrustedPicker, hasBaseDir, resolvedDir } }
}

function sanitizeImportInit(init: unknown): Record<string, unknown> | undefined {
  if (!init || typeof init !== 'object') return undefined
  const raw = init as Record<string, unknown>
  const output: Record<string, unknown> = {}
  for (const key of ['name', 'skillId', 'designSystemId'] as const) {
    if (raw[key] === undefined) continue
    if (raw[key] === null || typeof raw[key] === 'string') output[key] = raw[key]
  }
  return output
}

async function postImportFolder(input: {
  apiBaseUrl: string
  baseDir: string
  desktopAuthSecret: Buffer
  init?: unknown
  registerDesktopAuthWithDaemon?: () => Promise<boolean>
  fetchImpl?: typeof fetch
}): Promise<PickAndImportResult> {
  const fetchImpl = input.fetchImpl ?? globalThis.fetch
  const importUrl = `${input.apiBaseUrl.replace(/\/+$/, '')}/api/import/folder`
  const requestBody = JSON.stringify({ baseDir: input.baseDir, ...sanitizeImportInit(input.init) })

  async function postOnce(): Promise<Response | { ok: false; reason: string }> {
    const token = mintImportToken(input.desktopAuthSecret, input.baseDir)
    try {
      return await fetchImpl(importUrl, {
        body: requestBody,
        headers: {
          'Content-Type': 'application/json',
          [DESKTOP_IMPORT_TOKEN_HEADER]: token,
        },
        method: 'POST',
      })
    } catch (error) {
      return { ok: false, reason: `daemon fetch failed: ${error instanceof Error ? error.message : String(error)}` }
    }
  }

  let resp = await postOnce()
  if ('reason' in resp) return { ok: false, reason: resp.reason }

  if (resp.status === 503 && input.registerDesktopAuthWithDaemon) {
    let body: unknown = null
    try { body = await resp.clone().json() } catch { body = null }
    const error = body && typeof body === 'object' ? (body as Record<string, unknown>).error : undefined
    const code = error && typeof error === 'object' ? (error as Record<string, unknown>).code : undefined
    if (code === 'DESKTOP_AUTH_PENDING' && await input.registerDesktopAuthWithDaemon()) {
      const retry = await postOnce()
      if ('reason' in retry) return { ok: false, reason: retry.reason }
      resp = retry
    }
  }

  let body: unknown = null
  try { body = await resp.json() } catch { body = null }
  if (!resp.ok) return { ok: false, reason: `daemon returned HTTP ${resp.status}`, ...(body == null ? {} : { details: body }) }
  return { ok: true, response: body }
}

function waitForPrintReadyHandshake(webContents: WebContents, nonce: string): Promise<void> {
  const safeNonce = JSON.stringify(nonce)
  const handshake = webContents.executeJavaScript(`(function() {
    if (window.__odPrintReady) return Promise.resolve(true);
    return new Promise(function(resolve) {
      window.addEventListener('message', function handler(event) {
        if (event.data && event.data.type === 'OD_PRINT_READY' && event.data.nonce === ${safeNonce}) {
          window.__odPrintReady = true;
          window.removeEventListener('message', handler);
          resolve(true);
        }
      });
    });
  })()`, true)
  const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Print handshake timed out')), PRINT_READY_TIMEOUT_MS))
  return Promise.race([handshake, timeout]).then(() => undefined)
}

export class RoxDesignDesktopBridge {
  constructor(private readonly getContext: () => DesktopAuthBridgeContext) {}

  async openExternal(url: unknown): Promise<boolean> {
    if (!isHttpUrl(url)) return false
    try {
      await shell.openExternal(url)
      return true
    } catch {
      return false
    }
  }

  async pickFolder(ownerWindow?: BrowserWindow | null): Promise<{ canceled: boolean; filePaths: string[] }> {
    const result = ownerWindow && !ownerWindow.isDestroyed()
      ? await dialog.showOpenDialog(ownerWindow, { properties: ['openDirectory'] })
      : await dialog.showOpenDialog({ properties: ['openDirectory'] })
    return { canceled: result.canceled, filePaths: result.filePaths }
  }

  async pickAndImport(ownerWindow: BrowserWindow | null | undefined, init?: unknown): Promise<PickAndImportResult> {
    const context = this.getContext()
    if (!context.desktopAuthSecret) return { ok: false, reason: 'desktop auth secret not registered' }
    if (!context.daemonUrl) return { ok: false, reason: 'daemon API URL not available' }

    const result = ownerWindow && !ownerWindow.isDestroyed()
      ? await dialog.showOpenDialog(ownerWindow, { properties: ['openDirectory'] })
      : await dialog.showOpenDialog({ properties: ['openDirectory'] })
    if (result.canceled || result.filePaths.length === 0) return { ok: false, canceled: true }

    const baseDir = result.filePaths[0].trim()
    if (baseDir.length === 0) return { ok: false, reason: 'picker returned an empty path' }
    const validated = await validateExistingDirectory(baseDir)
    if (!validated.ok) return { ok: false, reason: validated.reason }

    return await postImportFolder({
      apiBaseUrl: context.daemonUrl,
      baseDir: validated.resolved,
      desktopAuthSecret: context.desktopAuthSecret,
      init,
      registerDesktopAuthWithDaemon: context.registerDesktopAuthWithDaemon,
    })
  }

  async openPath(projectId: unknown): Promise<string> {
    const context = this.getContext()
    if (!context.daemonUrl) return 'open-path: daemon API URL not available'

    const resolved = await fetchResolvedProjectDir(context.daemonUrl, projectId)
    if (!resolved.ok) return `open-path: ${resolved.reason}`

    const allowed = isOpenPathAllowedForProject(resolved.context)
    if (!allowed.ok) return `open-path: ${allowed.reason}`

    const validated = await validateExistingDirectory(resolved.context.resolvedDir)
    if (!validated.ok) return `open-path: ${validated.reason}`

    try {
      return await shell.openPath(validated.resolved)
    } catch (error) {
      return error instanceof Error ? error.message : String(error)
    }
  }

  async printPdf(html: unknown, nonce: unknown): Promise<void> {
    if (typeof html !== 'string') throw new Error('Invalid print payload: expected HTML string')
    if (Buffer.byteLength(html, 'utf8') > MAX_PRINT_HTML_BYTES) {
      throw new Error(`printPdf html payload exceeds MAX_PRINT_HTML_BYTES limit`)
    }
    const printNonce = typeof nonce === 'string' ? nonce : ''
    const printWindow = new BrowserWindow({
      width: 800,
      height: 600,
      show: false,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    })
    printWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
    printWindow.webContents.on('will-navigate', (event) => event.preventDefault())
    try {
      await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
      await waitForPrintReadyHandshake(printWindow.webContents, printNonce)
      printWindow.show()
      await new Promise<void>((resolvePrint, rejectPrint) => {
        printWindow.webContents.print({ printBackground: true }, (success, failureReason) => {
          if (success || failureReason === 'Print job canceled') resolvePrint()
          else rejectPrint(new Error(failureReason ?? 'Print failed'))
        })
      })
    } finally {
      if (!printWindow.isDestroyed()) printWindow.close()
    }
  }
}
