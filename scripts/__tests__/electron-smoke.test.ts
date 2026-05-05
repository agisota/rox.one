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

  it('applies the smoke userData directory before the single-instance lock', () => {
    const main = readFileSync(join(rootDir, 'apps/electron/src/main/index.ts'), 'utf8');
    const smokePathIndex = main.indexOf('ROX_SMOKE_USER_DATA_DIR');
    const lockIndex = main.indexOf('requestSingleInstanceLock');

    expect(smokePathIndex).toBeGreaterThan(-1);
    expect(lockIndex).toBeGreaterThan(-1);
    expect(smokePathIndex).toBeLessThan(lockIndex);
  });
});
