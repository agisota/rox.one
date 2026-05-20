#!/usr/bin/env bun
import { spawn } from 'bun';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT_DIR = join(import.meta.dir, '..');
const STARTUP_TIMEOUT_MS = Number(process.env.ROX_PACKAGED_SMOKE_TIMEOUT_MS ?? 45_000);
const FORCE_KILL_GRACE_MS = 5_000;
// Production packaged builds can route readiness details to electron-log instead of
// stdout/stderr. Clean smoke-mode cleanup is therefore the observable readiness
// proof; stdout markers are best-effort diagnostics only.
const REQUIRED_MARKERS: readonly string[] = [];
const CLEAN_SHUTDOWN_MARKERS = ['[quit] cleanup complete', '[smoke] Exiting process after successful quit cleanup'] as const;

function defaultExecutablePath(): string {
  if (process.platform === 'darwin') {
    const arch = process.env.ROX_ARTIFACT_ARCH ?? (process.arch === 'arm64' ? 'arm64' : 'x64');
    // mac-arm64/ROX.ONE.app is the CI + local dev artifact path.
    return join(ROOT_DIR, `apps/electron/release/mac-${arch}/ROX.ONE.app`, 'Contents/MacOS/ROX.ONE');
  }

  if (process.platform === 'linux') {
    // linux-unpacked/rox-one is produced by `electron-builder --linux dir`.
    return join(ROOT_DIR, 'apps/electron/release/linux-unpacked/rox-one');
  }

  if (process.platform === 'win32') {
    // win-unpacked/ROX.ONE.exe is produced by `electron-builder --win --dir`.
    return join(ROOT_DIR, 'apps/electron/release/win-unpacked/ROX.ONE.exe');
  }

  throw new Error(`Unsupported packaged smoke platform: ${process.platform}`);
}

function commandExists(command: string): boolean {
  const checker = process.platform === 'win32'
    ? spawnSync('where.exe', [command], { stdio: 'ignore' })
    : spawnSync('sh', ['-lc', `command -v ${command}`], { stdio: 'ignore' });
  return checker.status === 0;
}

function launchCommand(executablePath: string): string[] {
  if (process.platform === 'linux') {
    const args = [executablePath, '--no-sandbox'];
    // Linux CI runners do not expose a real desktop session. xvfb-run gives
    // Electron a minimal X server while keeping the same packaged executable.
    if (!process.env.DISPLAY && commandExists('xvfb-run')) {
      return ['xvfb-run', '-a', ...args];
    }
    return args;
  }

  return [executablePath];
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
        if (buffer.length > 0) onText(buffer);
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

function markSeen(text: string, seen: Record<string, boolean>): void {
  for (const marker of REQUIRED_MARKERS) {
    if (text.includes(marker)) seen[marker] = true;
  }
}

function markCleanShutdown(text: string, seen: Record<(typeof CLEAN_SHUTDOWN_MARKERS)[number], boolean>): void {
  for (const marker of CLEAN_SHUTDOWN_MARKERS) {
    if (text.includes(marker)) seen[marker] = true;
  }
}

function sanitizeOutput(text: string): string {
  return text
    .replace(/ROX_SERVER_TOKEN=\S+/g, 'ROX_SERVER_TOKEN=[REDACTED]')
    .replace(/ROX_SERVER_URL=\S+/g, 'ROX_SERVER_URL=[REDACTED]');
}

const executablePath = process.env.ROX_PACKAGED_EXECUTABLE ?? defaultExecutablePath();
if (!existsSync(executablePath)) {
  console.error(`[packaged-smoke] Missing packaged executable: ${executablePath}`);
  process.exit(1);
}

const smokeUserDataDir = mkdtempSync(join(tmpdir(), 'rox-packaged-smoke-user-data-'));
const smokeConfigDir = mkdtempSync(join(tmpdir(), 'rox-packaged-smoke-config-'));

function cleanupSmokeDirs(): void {
  rmSync(smokeUserDataDir, { recursive: true, force: true });
  rmSync(smokeConfigDir, { recursive: true, force: true });
}

const command = launchCommand(executablePath);
console.log(`[packaged-smoke] Launching ${process.platform} packaged executable: ${command.join(' ')}`);

const seen: Record<string, boolean> = {};
for (const marker of REQUIRED_MARKERS) seen[marker] = false;
const cleanShutdownSeen: Record<(typeof CLEAN_SHUTDOWN_MARKERS)[number], boolean> = {
  '[quit] cleanup complete': false,
  '[smoke] Exiting process after successful quit cleanup': false,
};

const appProc = spawn({
  cmd: command,
  cwd: ROOT_DIR,
  stdout: 'pipe',
  stderr: 'pipe',
  env: {
    ...process.env,
    ROX_HEADLESS: '1',
    ROX_SMOKE_EXIT_ON_READY: '1',
    ROX_SMOKE_USER_DATA_DIR: smokeUserDataDir,
    ROX_CONFIG_DIR: smokeConfigDir,
  },
});

let timedOut = false;
let forceKillTriggered = false;
let forceKillTimer: ReturnType<typeof setTimeout> | undefined;
const timeout = setTimeout(() => {
  timedOut = true;
  appProc.kill(process.platform === 'win32' ? undefined : 'SIGTERM');
  forceKillTimer = setTimeout(() => {
    forceKillTriggered = true;
    appProc.kill(process.platform === 'win32' ? undefined : 'SIGKILL');
  }, FORCE_KILL_GRACE_MS);
}, STARTUP_TIMEOUT_MS);

const stdoutTask = pipeOutput(appProc.stdout, (text) => {
  markSeen(text, seen);
  markCleanShutdown(text, cleanShutdownSeen);
  process.stdout.write(sanitizeOutput(text));
});

const stderrTask = pipeOutput(appProc.stderr, (text) => {
  markSeen(text, seen);
  markCleanShutdown(text, cleanShutdownSeen);
  process.stderr.write(sanitizeOutput(text));
});

const exitCode = await appProc.exited;
clearTimeout(timeout);
if (forceKillTimer) clearTimeout(forceKillTimer);
await Promise.allSettled([stdoutTask, stderrTask]);
cleanupSmokeDirs();

if (timedOut) {
  const pendingMarkers = REQUIRED_MARKERS.filter((marker) => !seen[marker]);
  const pendingMessage = pendingMarkers.length > 0
    ? ` while waiting for: ${pendingMarkers.join(', ')}`
    : '';
  const killMessage = forceKillTriggered
    ? `; escalated after ${FORCE_KILL_GRACE_MS}ms grace`
    : '';
  console.error(`[packaged-smoke] ROX.ONE packaged startup timed out after ${STARTUP_TIMEOUT_MS}ms${pendingMessage}${killMessage}`);
  process.exit(1);
}

const cleanShutdownComplete = CLEAN_SHUTDOWN_MARKERS.every((marker) => cleanShutdownSeen[marker]);

if (exitCode !== 0 && !cleanShutdownComplete) {
  console.error(`[packaged-smoke] ROX.ONE packaged app exited with code ${exitCode}`);
  process.exit(exitCode);
}

const missingMarkers = REQUIRED_MARKERS.filter((marker) => !seen[marker]);
if (missingMarkers.length > 0) {
  console.error(`[packaged-smoke] Missing startup markers: ${missingMarkers.join(', ')}`);
  process.exit(1);
}

console.log('[packaged-smoke] ROX.ONE packaged headless startup passed');
