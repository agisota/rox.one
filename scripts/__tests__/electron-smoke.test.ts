import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'bun:test';

const rootDir = join(import.meta.dir, '..', '..');

describe('electron smoke isolation', () => {
  it('launches smoke Electron with isolated runtime directories', () => {
    const script = readFileSync(join(rootDir, 'scripts/electron-smoke.ts'), 'utf8');

    expect(script).toContain('ROX_SMOKE_USER_DATA_DIR');
    expect(script).toContain('ROX_CONFIG_DIR');
    expect(script).toContain('mkdtempSync');
  });

  it('accepts clean smoke shutdown proof before nudging the Electron wrapper closed', () => {
    const script = readFileSync(join(rootDir, 'scripts/electron-smoke.ts'), 'utf8');

    expect(script).toContain('CLEAN_SHUTDOWN_MARKERS');
    expect(script).toContain('[quit] cleanup complete');
    expect(script).toContain('[smoke] Exiting process after successful quit cleanup');
    expect(script).toContain('hasSeenRequiredStartup() && hasSeenCleanSmokeShutdown()');
  });

  it('applies the smoke userData directory before the single-instance lock', () => {
    const main = readFileSync(join(rootDir, 'apps/electron/src/main/index.ts'), 'utf8');
    const smokePathIndex = main.indexOf('ROX_SMOKE_USER_DATA_DIR');
    const lockIndex = main.indexOf('requestSingleInstanceLock');

    expect(smokePathIndex).toBeGreaterThan(-1);
    expect(lockIndex).toBeGreaterThan(-1);
    expect(smokePathIndex).toBeLessThan(lockIndex);
  });

  it('keeps the smoke force-exit fallback alive during async quit cleanup', () => {
    const main = readFileSync(join(rootDir, 'apps/electron/src/main/index.ts'), 'utf8');
    const smokeShutdownStart = main.indexOf('const scheduleSmokeShutdown =');
    const smokeShutdownEnd = main.indexOf('// Export packaged state as env var');
    const smokeShutdown = main.slice(smokeShutdownStart, smokeShutdownEnd);

    expect(smokeShutdownStart).toBeGreaterThan(-1);
    expect(smokeShutdownEnd).toBeGreaterThan(smokeShutdownStart);
    expect(smokeShutdown).toContain('app.quit()');
    expect(smokeShutdown).toContain('setTimeout(() => app.exit(exitCode), 1_000)');
    expect(smokeShutdown).not.toContain('.unref()');
  });

  it('forces process termination after smoke quit cleanup finishes', () => {
    const main = readFileSync(join(rootDir, 'apps/electron/src/main/index.ts'), 'utf8');
    const quitCleanupIndex = main.indexOf("mainLog.info('[quit] cleanup complete'");
    const smokeProcessExitIndex = main.indexOf("process.env.ROX_SMOKE_EXIT_ON_READY === '1'", quitCleanupIndex);

    expect(quitCleanupIndex).toBeGreaterThan(-1);
    expect(smokeProcessExitIndex).toBeGreaterThan(quitCleanupIndex);
    expect(main.slice(smokeProcessExitIndex, smokeProcessExitIndex + 260)).toContain("process.kill(process.pid, 'SIGKILL')");
  });
});
