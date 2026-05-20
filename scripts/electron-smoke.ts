/**
 * Repeatable Electron smoke test for the supported headless startup path.
 *
 * The script rebuilds the Electron app, launches it in headless mode,
 * waits for startup markers, and requires a clean shutdown.
 */

import { spawn } from 'bun'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const ROOT_DIR = join(import.meta.dir, '..')
const ELECTRON_DIR = join(ROOT_DIR, 'apps/electron')
const ELECTRON_BIN = process.platform === 'win32'
  ? join(ROOT_DIR, 'node_modules', '.bin', 'electron.cmd')
  : join(ROOT_DIR, 'node_modules', '.bin', 'electron')

const STARTUP_TIMEOUT_MS = 30_000
const FORCE_KILL_GRACE_MS = 5_000
const REQUIRED_MARKERS = ['ROX_SERVER_URL=', 'App initialized successfully'] as const
const CLEAN_SHUTDOWN_MARKERS = ['[quit] cleanup complete', '[smoke] Exiting process after successful quit cleanup'] as const
const smokeUserDataDir = mkdtempSync(join(tmpdir(), 'rox-electron-smoke-user-data-'))
const smokeConfigDir = mkdtempSync(join(tmpdir(), 'rox-electron-smoke-config-'))

function cleanupSmokeDirs(): void {
  rmSync(smokeUserDataDir, { recursive: true, force: true })
  rmSync(smokeConfigDir, { recursive: true, force: true })
}

async function pipeOutput(
  stream: ReadableStream<Uint8Array> | null,
  onText: (text: string) => void,
): Promise<void> {
  if (!stream) return

  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        buffer += decoder.decode()
        if (buffer.length > 0) {
          onText(buffer)
        }
        break
      }

      buffer += decoder.decode(value, { stream: true })

      let newlineIndex = buffer.indexOf('\n')
      while (newlineIndex !== -1) {
        onText(buffer.slice(0, newlineIndex + 1))
        buffer = buffer.slice(newlineIndex + 1)
        newlineIndex = buffer.indexOf('\n')
      }
    }
  } catch {
    // Stream can close during shutdown; the process exit code is the source of truth.
  }
}

function markSeen(text: string, seen: Record<(typeof REQUIRED_MARKERS)[number], boolean>) {
  for (const marker of REQUIRED_MARKERS) {
    if (text.includes(marker)) {
      seen[marker] = true
    }
  }
}

function sanitizeOutput(text: string): string {
  return text
    .replace(/ROX_SERVER_TOKEN=\S+/g, 'ROX_SERVER_TOKEN=[REDACTED]')
    .replace(/ROX_SERVER_URL=\S+/g, 'ROX_SERVER_URL=[REDACTED]')
}

const buildProc = spawn({
  cmd: ['bun', 'run', 'electron:build'],
  cwd: ROOT_DIR,
  stdout: 'inherit',
  stderr: 'inherit',
  env: process.env,
})

const buildExitCode = await buildProc.exited
if (buildExitCode !== 0) {
  cleanupSmokeDirs()
  process.exit(buildExitCode)
}

const seen: Record<(typeof REQUIRED_MARKERS)[number], boolean> = {
  'ROX_SERVER_URL=': false,
  'App initialized successfully': false,
}
const cleanShutdownSeen: Record<(typeof CLEAN_SHUTDOWN_MARKERS)[number], boolean> = {
  '[quit] cleanup complete': false,
  '[smoke] Exiting process after successful quit cleanup': false,
}

const electronProc = spawn({
  cmd: [ELECTRON_BIN, '.'],
  cwd: ELECTRON_DIR,
  stdout: 'pipe',
  stderr: 'pipe',
  env: {
    ...process.env,
    ROX_HEADLESS: '1',
    ROX_SMOKE_EXIT_ON_READY: '1',
    ROX_SMOKE_USER_DATA_DIR: smokeUserDataDir,
    ROX_CONFIG_DIR: smokeConfigDir,
  },
})

let timedOut = false
let forceKillTriggered = false
let forceKillTimer: ReturnType<typeof setTimeout> | undefined
let successKillTimer: ReturnType<typeof setTimeout> | undefined
const timeout = setTimeout(() => {
  timedOut = true
  electronProc.kill('SIGTERM')
  forceKillTimer = setTimeout(() => {
    forceKillTriggered = true
    electronProc.kill('SIGKILL')
  }, FORCE_KILL_GRACE_MS)
}, STARTUP_TIMEOUT_MS)

function hasSeenRequiredStartup(): boolean {
  return REQUIRED_MARKERS.every((marker) => seen[marker])
}

function hasSeenCleanSmokeShutdown(): boolean {
  return CLEAN_SHUTDOWN_MARKERS.every((marker) => cleanShutdownSeen[marker])
}

function noteCleanShutdown(text: string): void {
  for (const marker of CLEAN_SHUTDOWN_MARKERS) {
    if (text.includes(marker)) {
      cleanShutdownSeen[marker] = true
    }
  }

  // Electron has already logged successful app cleanup. On macOS/Bun the
  // electron wrapper can keep the spawn handle open even after the app process
  // logs process-exit intent, so nudge the wrapper closed after proof exists.
  if (!successKillTimer && hasSeenRequiredStartup() && hasSeenCleanSmokeShutdown()) {
    successKillTimer = setTimeout(() => {
      electronProc.kill('SIGTERM')
    }, 250)
  }
}

const stdoutTask = pipeOutput(electronProc.stdout, (text) => {
  markSeen(text, seen)
  noteCleanShutdown(text)
  process.stdout.write(sanitizeOutput(text))
})

const stderrTask = pipeOutput(electronProc.stderr, (text) => {
  markSeen(text, seen)
  noteCleanShutdown(text)
  process.stderr.write(sanitizeOutput(text))
})

const exitCode = await electronProc.exited
clearTimeout(timeout)
if (forceKillTimer) {
  clearTimeout(forceKillTimer)
}
if (successKillTimer) {
  clearTimeout(successKillTimer)
}
await Promise.allSettled([stdoutTask, stderrTask])
cleanupSmokeDirs()

if (timedOut) {
  const pendingMarkers = REQUIRED_MARKERS.filter((marker) => !seen[marker])
  const pendingMessage = pendingMarkers.length > 0
    ? ` while waiting for: ${pendingMarkers.join(', ')}`
    : ''
  const killMessage = forceKillTriggered
    ? `; escalated to SIGKILL after ${FORCE_KILL_GRACE_MS}ms grace`
    : ''
  console.error(`[smoke] Electron startup timed out after ${STARTUP_TIMEOUT_MS}ms${pendingMessage}${killMessage}`)
  process.exit(1)
}

if (exitCode !== 0 && !hasSeenCleanSmokeShutdown()) {
  console.error(`[smoke] Electron exited with code ${exitCode}`)
  process.exit(exitCode)
}

const missingMarkers = REQUIRED_MARKERS.filter((marker) => !seen[marker])
if (missingMarkers.length > 0) {
  console.error(`[smoke] Missing startup markers: ${missingMarkers.join(', ')}`)
  process.exit(1)
}

console.log('[smoke] Electron headless startup passed')
