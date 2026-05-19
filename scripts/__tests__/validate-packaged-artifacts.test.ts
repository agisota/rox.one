/**
 * T503 — bun:test coverage for validate-packaged-artifacts.ts
 *
 * Tests platform-scoped signed/unsigned validation.
 * Uses a temporary fixture directory populated with synthetic files so
 * no real Apple/Windows signing infrastructure is required.
 *
 * The validator is invoked via spawnSync so exit codes are observable.
 */
import { spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

const repoRoot = join(import.meta.dir, '..', '..');
const validatorPath = join(repoRoot, 'scripts/validate-packaged-artifacts.ts');

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

/** Bytes representing a "real" artifact (>= 50 MB) */
const FIFTY_MB = 50 * 1024 * 1024;
/** Bytes representing a generously sized synthetic blockmap fixture. */
const ONE_MB = 1 * 1024 * 1024;

function createFakeFile(filePath: string, size: number): void {
  writeFileSync(filePath, Buffer.alloc(size, 0x42));
}

/** Minimal latest-mac.yml content referencing both dmg and zip. */
function latestMacYml(dmgSize: number, zipSize: number): string {
  return [
    'version: 1.2.3',
    `path: ROX-ONE-arm64.zip`,
    'files:',
    `  - url: ROX-ONE-arm64.zip`,
    `    size: ${zipSize}`,
    `  - url: ROX-ONE-arm64.dmg`,
    `    size: ${dmgSize}`,
  ].join('\n');
}

/** Minimal latest.yml content for Windows. */
function latestYml(exeSize: number, blockmapSize: number = ONE_MB): string {
  return [
    'version: 1.2.3',
    'path: ROX-ONE-x64.exe',
    'files:',
    `  - url: ROX-ONE-x64.exe`,
    `    size: ${exeSize}`,
    `  - url: ROX-ONE-x64.exe.blockmap`,
    `    size: ${blockmapSize}`,
  ].join('\n');
}

interface FixtureOptions {
  /** Provide Mac artifacts (dmg, zip, blockmaps, latest-mac.yml) */
  mac?: boolean;
  /** Provide Windows artifacts (exe, blockmap, latest.yml) */
  windows?: boolean;
  /** Provide Linux artifacts (deb, rpm, AppImage, .sig) */
  linux?: boolean;
  /** Provide Linux AppImage signature sidecar (default true when linux=true) */
  linuxSignature?: boolean;
  /** Override dmg size (default FIFTY_MB) */
  dmgSize?: number;
  /** Override zip size (default FIFTY_MB) */
  zipSize?: number;
  /** Override exe size (default FIFTY_MB) */
  exeSize?: number;
  /** Override blockmap size (default ONE_MB) */
  blockmapSize?: number;
}

/**
 * Creates a temporary release directory and populates it with the requested
 * fixture artifacts.  Returns the path to the fake "apps/electron/release".
 */
function buildFixture(opts: FixtureOptions): string {
  const base = mkdtempSync(join(tmpdir(), 'rox-artifact-test-'));
  // Mimic the expected directory layout that the validator assumes relative to
  // process.cwd(): apps/electron/release/
  const releaseDir = join(base, 'apps', 'electron', 'release');
  mkdirSync(releaseDir, { recursive: true });

  const {
    mac = false,
    windows = false,
    linux = false,
    linuxSignature = true,
    dmgSize = FIFTY_MB,
    zipSize = FIFTY_MB,
    exeSize = FIFTY_MB,
    blockmapSize = ONE_MB,
  } = opts;

  if (linux) {
    createFakeFile(join(releaseDir, 'ROX-ONE-amd64.deb'), FIFTY_MB);
    createFakeFile(join(releaseDir, 'ROX-ONE-x86_64.rpm'), FIFTY_MB);
    createFakeFile(join(releaseDir, 'ROX-ONE-x86_64.AppImage'), FIFTY_MB);
    if (linuxSignature) {
      writeFileSync(join(releaseDir, 'ROX-ONE-x86_64.AppImage.sig'), 'fake-gpg-sig\n');
    }
  }

  if (mac) {
    createFakeFile(join(releaseDir, 'ROX-ONE-arm64.dmg'), dmgSize);
    createFakeFile(join(releaseDir, 'ROX-ONE-arm64.zip'), zipSize);
    createFakeFile(join(releaseDir, 'ROX-ONE-arm64.dmg.blockmap'), blockmapSize);
    createFakeFile(join(releaseDir, 'ROX-ONE-arm64.zip.blockmap'), blockmapSize);
    writeFileSync(
      join(releaseDir, 'latest-mac.yml'),
      latestMacYml(dmgSize, zipSize),
    );
  }

  if (windows) {
    createFakeFile(join(releaseDir, 'ROX-ONE-x64.exe'), exeSize);
    createFakeFile(join(releaseDir, 'ROX-ONE-x64.exe.blockmap'), blockmapSize);
    writeFileSync(join(releaseDir, 'latest.yml'), latestYml(exeSize, blockmapSize));
  }

  return base;
}

/** Run the validator script in a given working directory with optional env overrides. */
function runValidator(cwd: string, env: Record<string, string> = {}): ReturnType<typeof spawnSync> {
  return spawnSync('bun', ['run', validatorPath], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
}

// ---------------------------------------------------------------------------
// Test lifecycle — clean up temp dirs
// ---------------------------------------------------------------------------

const tempDirs: string[] = [];

beforeEach(() => {
  // nothing to do per-test; dirs tracked in array for cleanup
});

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function fixture(opts: FixtureOptions): string {
  const dir = buildFixture(opts);
  tempDirs.push(dir);
  return dir;
}

// ---------------------------------------------------------------------------
// Unsigned mode tests
// ---------------------------------------------------------------------------

describe('unsigned mode (ROX_RC_MODE=unsigned)', () => {
  test('passes Mac validation with hosted-sized blockmaps below 1 MB', () => {
    const cwd = fixture({ mac: true, blockmapSize: 235 * 1024 });
    const result = runValidator(cwd, { ROX_RC_MODE: 'unsigned', ROX_ARTIFACT_PLATFORM: 'mac' });
    const combined = `${result.stdout ?? ''}${result.stderr ?? ''}`;
    expect(result.status).toBe(0);
    expect(combined).toContain('ROX-ONE-arm64.dmg.blockmap');
    expect(combined).toContain('platform=mac');
  });

  test('passes Mac validation with only Mac artifacts', () => {
    const cwd = fixture({ mac: true });
    const result = runValidator(cwd, { ROX_RC_MODE: 'unsigned', ROX_ARTIFACT_PLATFORM: 'mac' });
    const combined = `${result.stdout ?? ''}${result.stderr ?? ''}`;
    expect(result.status).toBe(0);
    expect(combined).toContain('[unsigned-beta] skipping code signature verification for mac');
    expect(combined).toContain('mode=unsigned-beta');
    expect(combined).toContain('platform=mac');
  });

  test('fails Mac validation when Mac dmg is missing', () => {
    const cwd = fixture({ windows: true }); // no mac
    const result = runValidator(cwd, { ROX_RC_MODE: 'unsigned', ROX_ARTIFACT_PLATFORM: 'mac' });
    const combined = `${result.stdout ?? ''}${result.stderr ?? ''}`;
    expect(result.status).not.toBe(0);
    expect(combined).toContain('missing required artifact');
    expect(combined).toContain('ROX-ONE-arm64');
  });

  test('passes Windows validation with only ROX-ONE-x64.exe artifacts', () => {
    const cwd = fixture({ windows: true });
    const result = runValidator(cwd, { ROX_RC_MODE: 'unsigned', ROX_ARTIFACT_PLATFORM: 'windows' });
    const combined = `${result.stdout ?? ''}${result.stderr ?? ''}`;
    expect(result.status).toBe(0);
    expect(combined).toContain('ROX-ONE-x64.exe');
    expect(combined).toContain('latest.yml artifact references verified');
    expect(combined).toContain('platform=windows');
  });

  test('passes Windows validation with hosted-sized blockmaps below 128 KB', () => {
    const cwd = fixture({ windows: true, blockmapSize: 116 * 1024 });
    const result = runValidator(cwd, { ROX_RC_MODE: 'unsigned', ROX_ARTIFACT_PLATFORM: 'windows' });
    const combined = `${result.stdout ?? ''}${result.stderr ?? ''}`;
    expect(result.status).toBe(0);
    expect(combined).toContain('ROX-ONE-x64.exe.blockmap');
    expect(combined).toContain('platform=windows');
  });

  test('passes unsigned Linux validation without AppImage signature sidecar', () => {
    const cwd = fixture({ linux: true, linuxSignature: false });
    const result = runValidator(cwd, {
      ROX_RC_MODE: 'unsigned',
      ROX_ARTIFACT_PLATFORM: 'linux',
      ROX_LINUX_DEB_RPM: 'true',
    });
    const combined = `${result.stdout ?? ''}${result.stderr ?? ''}`;
    expect(result.status).toBe(0);
    expect(combined).toContain('ROX-ONE-amd64.deb');
    expect(combined).toContain('ROX-ONE-x86_64.rpm');
    expect(combined).toContain('ROX-ONE-x86_64.AppImage');
    expect(combined).not.toContain('ROX-ONE-x86_64.AppImage.sig');
    expect(combined).toContain('mode=unsigned-beta');
    expect(combined).toContain('platform=linux');
  });

  test('fails Windows validation when latest.yml installer size is stale', () => {
    const cwd = fixture({ windows: true });
    writeFileSync(
      join(cwd, 'apps', 'electron', 'release', 'latest.yml'),
      latestYml(FIFTY_MB - 1, ONE_MB),
    );
    const result = runValidator(cwd, { ROX_RC_MODE: 'unsigned', ROX_ARTIFACT_PLATFORM: 'windows' });
    const combined = `${result.stdout ?? ''}${result.stderr ?? ''}`;
    expect(result.status).not.toBe(0);
    expect(combined).toContain('latest.yml size for ROX-ONE-x64.exe does not match artifact on disk');
  });

  test('passes Windows validation when latest.yml omits the blockmap entry', () => {
    const cwd = fixture({ windows: true });
    writeFileSync(
      join(cwd, 'apps', 'electron', 'release', 'latest.yml'),
      [
        'version: 1.2.3',
        'path: ROX-ONE-x64.exe',
        'files:',
        '  - url: ROX-ONE-x64.exe',
        `    size: ${FIFTY_MB}`,
      ].join('\n'),
    );
    const result = runValidator(cwd, { ROX_RC_MODE: 'unsigned', ROX_ARTIFACT_PLATFORM: 'windows' });
    const combined = `${result.stdout ?? ''}${result.stderr ?? ''}`;
    expect(result.status).toBe(0);
    expect(combined).toContain('latest.yml does not list ROX-ONE-x64.exe.blockmap');
    expect(combined).toContain('platform=windows');
  });

  test('fails Windows validation when latest.yml blockmap size is stale', () => {
    const cwd = fixture({ windows: true });
    writeFileSync(
      join(cwd, 'apps', 'electron', 'release', 'latest.yml'),
      latestYml(FIFTY_MB, ONE_MB - 1),
    );
    const result = runValidator(cwd, { ROX_RC_MODE: 'unsigned', ROX_ARTIFACT_PLATFORM: 'windows' });
    const combined = `${result.stdout ?? ''}${result.stderr ?? ''}`;
    expect(result.status).not.toBe(0);
    expect(combined).toContain('latest.yml size for ROX-ONE-x64.exe.blockmap does not match artifact on disk');
  });

  test('fails when dmg is present but empty (0 bytes)', () => {
    // Build full fixture then replace dmg with 0-byte file
    const cwd = fixture({ mac: true, dmgSize: 0 });
    const result = runValidator(cwd, { ROX_RC_MODE: 'unsigned', ROX_ARTIFACT_PLATFORM: 'mac' });
    const combined = `${result.stdout ?? ''}${result.stderr ?? ''}`;
    expect(result.status).not.toBe(0);
    expect(combined).toContain('artifact too small');
    expect(combined).toContain('ROX-ONE-arm64.dmg');
  });

  test('fails when exe is present but empty (0 bytes)', () => {
    const cwd = fixture({ windows: true, exeSize: 0 });
    const result = runValidator(cwd, { ROX_RC_MODE: 'unsigned', ROX_ARTIFACT_PLATFORM: 'windows' });
    const combined = `${result.stdout ?? ''}${result.stderr ?? ''}`;
    expect(result.status).not.toBe(0);
    expect(combined).toContain('artifact too small');
    expect(combined).toContain('ROX-ONE-x64.exe');
  });

  test('fails when blockmap is present but empty (0 bytes)', () => {
    const cwd = fixture({ windows: true, blockmapSize: 0 });
    const result = runValidator(cwd, { ROX_RC_MODE: 'unsigned', ROX_ARTIFACT_PLATFORM: 'windows' });
    const combined = `${result.stdout ?? ''}${result.stderr ?? ''}`;
    expect(result.status).not.toBe(0);
    expect(combined).toContain('artifact too small');
  });
});

// ---------------------------------------------------------------------------
// Signed mode tests
// ---------------------------------------------------------------------------

describe('signed mode (ROX_RC_MODE="" / default)', () => {
  test('fails immediately when mac artifacts are missing (no packaged runtime lookup)', () => {
    // Signed mode requires Mac artifacts — empty release dir should fail fast
    const cwd = fixture({ linux: true }); // no mac artifacts
    const result = runValidator(cwd, { ROX_RC_MODE: '', ROX_ARTIFACT_PLATFORM: 'mac' });
    const combined = `${result.stdout ?? ''}${result.stderr ?? ''}`;
    expect(result.status).not.toBe(0);
    expect(combined).toContain('missing required artifact');
  });

  test('passes Linux signed artifact checks with x64 builder output only', () => {
    const cwd = fixture({ linux: true });
    const result = runValidator(cwd, { ROX_RC_MODE: '', ROX_ARTIFACT_PLATFORM: 'linux' });
    const combined = `${result.stdout ?? ''}${result.stderr ?? ''}`;
    expect(result.status).toBe(0);
    expect(combined).toContain('ROX-ONE-x86_64.AppImage');
    expect(combined).toContain('ROX-ONE-x86_64.AppImage.sig');
    expect(combined).toContain('platform=linux');
  });

  test('fails signed Linux validation when AppImage signature is missing', () => {
    const cwd = fixture({ linux: true, linuxSignature: false });
    const result = runValidator(cwd, { ROX_RC_MODE: '', ROX_ARTIFACT_PLATFORM: 'linux' });
    const combined = `${result.stdout ?? ''}${result.stderr ?? ''}`;
    expect(result.status).not.toBe(0);
    expect(combined).toContain('missing required artifact');
    expect(combined).toContain('ROX-ONE-x86_64.AppImage.sig');
  });

  test('fails when Linux artifacts are missing in signed Linux validation', () => {
    const cwd = fixture({ mac: true }); // linux missing
    const result = runValidator(cwd, { ROX_RC_MODE: '', ROX_ARTIFACT_PLATFORM: 'linux' });
    const combined = `${result.stdout ?? ''}${result.stderr ?? ''}`;
    expect(result.status).not.toBe(0);
    expect(combined).toContain('missing required artifact');
    expect(combined).toContain('ROX-ONE-x86_64.AppImage');
  });

  test('fails when dmg size is below 50 MB threshold in signed mode', () => {
    const cwd = fixture({ mac: true, dmgSize: 1024 });
    const result = runValidator(cwd, { ROX_RC_MODE: '', ROX_ARTIFACT_PLATFORM: 'mac' });
    const combined = `${result.stdout ?? ''}${result.stderr ?? ''}`;
    expect(result.status).not.toBe(0);
    expect(combined).toContain('artifact too small');
    expect(combined).toContain('ROX-ONE-arm64.dmg');
  });

  test('does NOT log unsigned-beta skip message in signed mode', () => {
    // Even when mac+linux are present, if it gets past size checks it will fail
    // on runtime binary — but it must never log the unsigned-beta skip.
    const cwd = fixture({ mac: true });
    const result = runValidator(cwd, { ROX_RC_MODE: '', ROX_ARTIFACT_PLATFORM: 'mac' });
    const combined = `${result.stdout ?? ''}${result.stderr ?? ''}`;
    expect(combined).not.toContain('[unsigned-beta]');
  });
});

// ---------------------------------------------------------------------------
// Mode-invariant tests
// ---------------------------------------------------------------------------

describe('mode-invariant behavior', () => {
  test('empty release directory fails in signed mode', () => {
    const cwd = fixture({});
    const result = runValidator(cwd, { ROX_RC_MODE: '', ROX_ARTIFACT_PLATFORM: 'mac' });
    expect(result.status).not.toBe(0);
    expect(`${result.stdout ?? ''}${result.stderr ?? ''}`).toContain('missing required artifact');
  });

  test('empty release directory fails in unsigned mode', () => {
    const cwd = fixture({});
    const result = runValidator(cwd, { ROX_RC_MODE: 'unsigned', ROX_ARTIFACT_PLATFORM: 'windows' });
    expect(result.status).not.toBe(0);
    expect(`${result.stdout ?? ''}${result.stderr ?? ''}`).toContain('missing required artifact');
  });
});
