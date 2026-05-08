import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'bun:test';

const rootDir = join(import.meta.dir, '..', '..');

function readScript(relativePath: string): string {
  return readFileSync(join(rootDir, relativePath), 'utf8');
}

describe('packaged Electron smoke contract', () => {
  it('uses clean process exit as packaged readiness proof without stale required markers', () => {
    const packagedSmoke = readScript('scripts/electron-smoke-packaged-mac.ts');
    const normalSmoke = readScript('scripts/electron-smoke.ts');

    expect(packagedSmoke).toContain('const REQUIRED_MARKERS: readonly string[] = [];');
    expect(packagedSmoke).toContain('clean smoke-mode exit is therefore the observable readiness proof');
    expect(packagedSmoke).not.toContain("'CRAFT_SERVER_URL=': false");
    expect(packagedSmoke).toContain("replace(/CRAFT_SERVER_TOKEN=\\S+/g, 'CRAFT_SERVER_TOKEN=[REDACTED]')");
    expect(packagedSmoke).toContain("replace(/CRAFT_SERVER_URL=\\S+/g, 'CRAFT_SERVER_URL=[REDACTED]')");

    expect(normalSmoke).toContain("const REQUIRED_MARKERS = ['CRAFT_SERVER_URL=', 'App initialized successfully'] as const");
  });
});
