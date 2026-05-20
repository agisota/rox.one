/**
 * Unit tests for scripts/prepare-rox-design-runtime.ts
 *
 * Covers PR #306 (feat/rox-design-payload-archive-supply-chain):
 *   - --from-archive mode (Mode 2) with SHA-256 verification
 *   - Missing --expected-sha256 guard
 *   - Successful archive extract + MANIFEST.json shape
 *   - Mode 1 (host-local, ROX_DESIGN_SOURCE_RESOURCES) backwards compat
 *
 * TARGET_DIR is hardcoded inside the script to
 *   <repo_root>/apps/electron/resources/rox-design
 * so each test suite saves/restores that directory.
 *
 * No network calls are made; archive tests use file:// URLs pointing at a
 * fixture tarball built in beforeAll.
 */
import { test, describe, expect, beforeAll, afterAll } from 'bun:test';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const repoRoot = resolve(join(import.meta.dir, '..', '..'));
const scriptPath = join(repoRoot, 'scripts', 'prepare-rox-design-runtime.ts');
const targetDir = join(repoRoot, 'apps', 'electron', 'resources', 'rox-design');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Run the prepare script as a subprocess. Returns spawnSync result. */
function runPrepare(
  args: string[],
  env: Record<string, string> = {},
): ReturnType<typeof spawnSync> {
  return spawnSync('bun', ['run', scriptPath, ...args], {
    cwd: repoRoot,
    env: { ...process.env, ...env },
    encoding: 'utf-8',
    timeout: 30_000,
  });
}

/**
 * Snapshot the current rox-design target dir into a temp directory and return
 * a restore function. Handles the case where the dir is already empty/gitignored.
 */
function snapshotTargetDir(): () => void {
  const snap = mkdtempSync(join(tmpdir(), 'rox-design-snap-'));
  if (existsSync(targetDir)) {
    cpSync(targetDir, snap, { recursive: true });
  }
  return () => {
    // Remove everything added by the script (all non-tracked entries).
    if (existsSync(targetDir)) {
      for (const entry of require('node:fs').readdirSync(targetDir)) {
        rmSync(join(targetDir, entry), { recursive: true, force: true });
      }
    } else {
      mkdirSync(targetDir, { recursive: true });
    }
    // Restore snapshot entries that were present before (covers gitignored payloads).
    for (const entry of require('node:fs').readdirSync(snap)) {
      cpSync(join(snap, entry), join(targetDir, entry), { recursive: true });
    }
    rmSync(snap, { recursive: true, force: true });
    // Always restore git-tracked files the script may have deleted.
    require('node:child_process').spawnSync(
      'git',
      ['checkout', '--', 'apps/electron/resources/rox-design/'],
      { cwd: repoRoot },
    );
  };
}

// ---------------------------------------------------------------------------
// Fixture: valid source directory + fixture tarball
// ---------------------------------------------------------------------------

const REQUIRED_SOURCE_PATHS = [
  'open-design-config.json',
  'app/prebundled/daemon/daemon-sidecar.mjs',
  'app/prebundled/daemon/daemon-cli.mjs',
  'app/node_modules/better-sqlite3/index.js',
  'app/node_modules/blake3-wasm/index.js',
  'app/prebundled/web-sidecar.mjs',
  'open-design/bin/node',
  'open-design/skills/.keep',
  'open-design/design-systems/.keep',
  'open-design/design-templates/.keep',
  'open-design/prompt-templates/.keep',
  'open-design-web-standalone/apps/web/server.js',
];

let fixtureSourceDir: string;
let fixtureTarball: string;
let fixtureSha256: string;
let fixtureFileUrl: string;
let restoreTarget: () => void;

function buildFixtureSource(dir: string): void {
  for (const p of REQUIRED_SOURCE_PATHS) {
    const full = join(dir, p);
    mkdirSync(require('node:path').dirname(full), { recursive: true });
    writeFileSync(full, `fixture:${p}`);
  }
  writeFileSync(
    join(dir, 'open-design-config.json'),
    JSON.stringify({ appVersion: '0.7.0-fixture' }),
  );
}

beforeAll(() => {
  // Build fixture source tree
  fixtureSourceDir = mkdtempSync(join(tmpdir(), 'rox-design-fixture-src-'));
  buildFixtureSource(fixtureSourceDir);

  // Build a real tarball from the fixture (same layout the script expects)
  const tarDir = mkdtempSync(join(tmpdir(), 'rox-design-fixture-tar-'));
  fixtureTarball = join(tarDir, 'fixture-payload.tar.gz');
  execFileSync(
    'tar',
    [
      '-czf',
      fixtureTarball,
      '-C',
      fixtureSourceDir,
      'open-design-config.json',
      'app/prebundled',
      'app/node_modules',
      'open-design',
      'open-design-web-standalone',
    ],
    { stdio: 'inherit' },
  );

  // Compute SHA-256
  const { createHash } = require('node:crypto');
  const hash = createHash('sha256');
  hash.update(readFileSync(fixtureTarball));
  fixtureSha256 = hash.digest('hex');

  fixtureFileUrl = `file://${fixtureTarball}`;

  // Snapshot the target dir so tests can safely write to it
  restoreTarget = snapshotTargetDir();
});

afterAll(() => {
  rmSync(fixtureSourceDir, { recursive: true, force: true });
  const tarDir = require('node:path').dirname(fixtureTarball);
  rmSync(tarDir, { recursive: true, force: true });
  restoreTarget();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('prepare-rox-design-runtime.ts — Mode 2 (--from-archive)', () => {
  test('wrong SHA-256 → exits non-zero', () => {
    const result = runPrepare([
      `--from-archive=${fixtureFileUrl}`,
      '--expected-sha256=0000000000000000000000000000000000000000000000000000000000000000',
      '--force',
    ]);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('SHA-256 mismatch');
  });

  test('missing --expected-sha256 with --from-archive → exits non-zero', () => {
    const result = runPrepare([`--from-archive=${fixtureFileUrl}`, '--force']);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('--expected-sha256');
  });

  test('correct SHA + valid tarball → extracts and writes MANIFEST.json with archiveSource + archiveSha256', () => {
    const result = runPrepare([
      `--from-archive=${fixtureFileUrl}`,
      `--expected-sha256=${fixtureSha256}`,
      '--force',
    ]);
    expect(result.status).toBe(0);

    const manifestPath = join(targetDir, 'MANIFEST.json');
    expect(existsSync(manifestPath)).toBe(true);

    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as Record<string, unknown>;
    expect(manifest.schema).toBe('rox-design-runtime-manifest.v1');
    expect(manifest.archiveSource).toBe(fixtureFileUrl);
    expect(manifest.archiveSha256).toBe(fixtureSha256);
    expect(manifest.version).toBe('0.7.0-fixture');
    expect(manifest.copiedAt).toBeTruthy();

    // Clean up for next tests
    for (const entry of require('node:fs').readdirSync(targetDir)) {
      if (['README.md', 'NOTICES.md'].includes(entry)) continue;
      rmSync(join(targetDir, entry), { recursive: true, force: true });
    }
  });
});

describe('prepare-rox-design-runtime.ts — Mode 1 (host-local, backwards compat)', () => {
  test('valid ROX_DESIGN_SOURCE_RESOURCES → exits 0 with no --from-archive', () => {
    const result = runPrepare(['--force'], {
      ROX_DESIGN_SOURCE_RESOURCES: fixtureSourceDir,
    });
    expect(result.status).toBe(0);

    const manifestPath = join(targetDir, 'MANIFEST.json');
    expect(existsSync(manifestPath)).toBe(true);

    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as Record<string, unknown>;
    expect(manifest.schema).toBe('rox-design-runtime-manifest.v1');
    expect(manifest.sourceRoot).toBe(fixtureSourceDir);
    // Mode 1 must NOT set archiveSha256
    expect(manifest.archiveSha256).toBeUndefined();
    expect(manifest.version).toBe('0.7.0-fixture');

    // Clean up
    for (const entry of require('node:fs').readdirSync(targetDir)) {
      if (['README.md', 'NOTICES.md'].includes(entry)) continue;
      rmSync(join(targetDir, entry), { recursive: true, force: true });
    }
  });

  test('--check flag with valid source → exits 0 without writing payload', () => {
    const result = runPrepare(['--check'], {
      ROX_DESIGN_SOURCE_RESOURCES: fixtureSourceDir,
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('source ok');
    // MANIFEST.json should NOT have been written by --check
    expect(existsSync(join(targetDir, 'MANIFEST.json'))).toBe(false);
  });
});
