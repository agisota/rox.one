import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'bun:test';

const rootDir = join(import.meta.dir, '..', '..');

function readJson(relativePath: string): { scripts?: Record<string, string> } {
  return JSON.parse(readFileSync(join(rootDir, relativePath), 'utf8'));
}

describe('Electron start script aliases', () => {
  it('funnels start commands through the canonical root electron:dev script', () => {
    const rootPackage = readJson('package.json');
    const electronPackage = readJson('apps/electron/package.json');

    expect(rootPackage.scripts?.['electron:dev']).toBe('bun run scripts/electron-dev.ts');
    expect(rootPackage.scripts?.['electron:start']).toBe('bun run electron:dev');
    expect(electronPackage.scripts?.start).toBe('cd ../.. && bun run electron:dev');
    expect(electronPackage.scripts?.['start:win']).toBe('cd ../.. && bun run electron:dev');
  });

  it('stages packaged resources into the branded macOS dev runtime', () => {
    const devScript = readFileSync(join(rootDir, 'scripts/electron-dev.ts'), 'utf8');

    expect(devScript).toContain('const sourceResources = join(ELECTRON_DIR, "dist", "resources")');
    expect(devScript).toContain('const packagedResources = join(brandedAppDir, "Contents", "Resources", "app", "resources")');
    expect(devScript).toContain('cpSync(sourceResources, packagedResources, { recursive: true, force: true })');
  });
});
