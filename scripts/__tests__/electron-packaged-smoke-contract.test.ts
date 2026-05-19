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
    const crossPlatformPackagedSmoke = readScript('scripts/electron-smoke-packaged.ts');
    const normalSmoke = readScript('scripts/electron-smoke.ts');

    for (const script of [packagedSmoke, crossPlatformPackagedSmoke]) {
      expect(script).toContain('const REQUIRED_MARKERS: readonly string[] = [];');
      expect(script).toContain('clean smoke-mode exit is therefore the observable readiness proof');
      expect(script).not.toContain("'ROX_SERVER_URL=': false");
      expect(script).toContain("replace(/ROX_SERVER_TOKEN=\\S+/g, 'ROX_SERVER_TOKEN=[REDACTED]')");
      expect(script).toContain("replace(/ROX_SERVER_URL=\\S+/g, 'ROX_SERVER_URL=[REDACTED]')");
    }

    expect(crossPlatformPackagedSmoke).toContain("linux-unpacked/rox-one");
    expect(crossPlatformPackagedSmoke).toContain("win-unpacked/ROX.ONE.exe");
    expect(crossPlatformPackagedSmoke).toContain("mac-arm64/ROX.ONE.app");
    expect(crossPlatformPackagedSmoke).toContain("--no-sandbox");
    expect(crossPlatformPackagedSmoke).toContain("xvfb-run");
    expect(crossPlatformPackagedSmoke).toContain("ROX_SMOKE_USER_DATA_DIR");

    expect(normalSmoke).toContain("const REQUIRED_MARKERS = ['ROX_SERVER_URL=', 'App initialized successfully'] as const");
  });
});
