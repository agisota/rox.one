#!/usr/bin/env bun
import { spawn } from 'bun';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT_DIR = join(import.meta.dir, '..');
const DEFAULT_APP_PATH = join(ROOT_DIR, 'apps/electron/release/mac-arm64/ROX ONE.app');
const APP_PATH = process.env.ROX_MAC_APP_PATH || DEFAULT_APP_PATH;
const EXECUTABLE_PATH = join(APP_PATH, 'Contents/MacOS/ROX ONE');
const STARTUP_TIMEOUT_MS = 30_000;
const FORCE_KILL_GRACE_MS = 5_000;
// Production packaged builds disable electron-log console transport, so the
// server URL marker plus a clean smoke-mode exit is the observable readiness proof.
const REQUIRED_MARKERS = ['CRAFT_SERVER_URL='] as const;

if (process.platform !== 'darwin') {
  console.error('[packaged-smoke] Packaged macOS smoke must run on darwin');
  process.exit(1);
}

if (!existsSync(EXECUTABLE_PATH)) {
  console.error(`[packaged-smoke] Missing packaged app executable: ${EXECUTABLE_PATH}`);
  process.exit(1);
}

async function pipeOutput(
  stream: ReadableStream<Uint8Array> | null,
  onText: (text: string) => void,
): Promise<void> {
  if (!stream) return;

  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        buffer += decoder.decode();
        if (buffer.length > 0) {
          onText(buffer);
        }
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      let newlineIndex = buffer.indexOf('\n');
      while (newlineIndex !== -1) {
        onText(buffer.slice(0, newlineIndex + 1));
        buffer = buffer.slice(newlineIndex + 1);
        newlineIndex = buffer.indexOf('\n');
      }
    }
  } catch {
    // Stream can close during shutdown; the process exit code is the source of truth.
  }
}

function markSeen(text: string, seen: Record<(typeof REQUIRED_MARKERS)[number], boolean>) {
  for (const marker of REQUIRED_MARKERS) {
    if (text.includes(marker)) {
      seen[marker] = true;
    }
  }
}

function sanitizeOutput(text: string): string {
  return text
    .replace(/CRAFT_SERVER_TOKEN=\S+/g, 'CRAFT_SERVER_TOKEN=[REDACTED]')
    .replace(/CRAFT_SERVER_URL=\S+/g, 'CRAFT_SERVER_URL=[REDACTED]');
}

const seen: Record<(typeof REQUIRED_MARKERS)[number], boolean> = {
  'CRAFT_SERVER_URL=': false,
};

const appProc = spawn({
  cmd: [EXECUTABLE_PATH],
  cwd: ROOT_DIR,
  stdout: 'pipe',
  stderr: 'pipe',
  env: {
    ...process.env,
    CRAFT_HEADLESS: '1',
    CRAFT_SMOKE_EXIT_ON_READY: '1',
  },
});

let timedOut = false;
let forceKillTriggered = false;
let forceKillTimer: ReturnType<typeof setTimeout> | undefined;
const timeout = setTimeout(() => {
  timedOut = true;
  appProc.kill('SIGTERM');
  forceKillTimer = setTimeout(() => {
    forceKillTriggered = true;
    appProc.kill('SIGKILL');
  }, FORCE_KILL_GRACE_MS);
}, STARTUP_TIMEOUT_MS);

const stdoutTask = pipeOutput(appProc.stdout, (text) => {
  markSeen(text, seen);
  process.stdout.write(sanitizeOutput(text));
});

const stderrTask = pipeOutput(appProc.stderr, (text) => {
  markSeen(text, seen);
  process.stderr.write(sanitizeOutput(text));
});

const exitCode = await appProc.exited;
clearTimeout(timeout);
if (forceKillTimer) {
  clearTimeout(forceKillTimer);
}
await Promise.allSettled([stdoutTask, stderrTask]);

if (timedOut) {
  const pendingMarkers = REQUIRED_MARKERS.filter((marker) => !seen[marker]);
  const pendingMessage = pendingMarkers.length > 0
    ? ` while waiting for: ${pendingMarkers.join(', ')}`
    : '';
  const killMessage = forceKillTriggered
    ? `; escalated to SIGKILL after ${FORCE_KILL_GRACE_MS}ms grace`
    : '';
  console.error(`[packaged-smoke] ROX ONE packaged startup timed out after ${STARTUP_TIMEOUT_MS}ms${pendingMessage}${killMessage}`);
  process.exit(1);
}

if (exitCode !== 0) {
  console.error(`[packaged-smoke] ROX ONE packaged app exited with code ${exitCode}`);
  process.exit(exitCode);
}

const missingMarkers = REQUIRED_MARKERS.filter((marker) => !seen[marker]);
if (missingMarkers.length > 0) {
  console.error(`[packaged-smoke] Missing startup markers: ${missingMarkers.join(', ')}`);
  process.exit(1);
}

console.log('[packaged-smoke] ROX ONE packaged headless startup passed');
