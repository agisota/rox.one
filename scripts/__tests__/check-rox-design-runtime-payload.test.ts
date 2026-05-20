/**
 * Unit tests for scripts/check-rox-design-runtime-payload.ts
 *
 * Covers PR #315 (feat/rox-design-payload-verify-versions-manifest-crosscheck):
 *   - No versions manifest + soft mode → cross-check skipped, exit 0
 *   - No versions manifest + --require-canonical → FAIL
 *   - Matching SHA between MANIFEST and versions[.current] → exit 0
 *   - Mismatched SHA → FAIL with re-prepare command in stderr
 *   - --require-canonical + Mode 1 payload (no archiveSha256 in MANIFEST) → FAIL
 *
 * Both TARGET_DIR and VERSIONS_MANIFEST_PATH are hardcoded inside the script
 * relative to import.meta.dir, so tests directly populate those paths and
 * restore them in afterAll.
 *
 * REQUIRED_PATHS inside the script are file existence checks; tests create
 * minimal stub files to satisfy them.
 */
import { test, describe, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

// ---------------------------------------------------------------------------
// Paths (must match the hardcoded values in the script)
// ---------------------------------------------------------------------------

const repoRoot = resolve(join(import.meta.dir, '..', '..'));
const scriptPath = join(repoRoot, 'scripts', 'check-rox-design-runtime-payload.ts');
const targetDir = join(repoRoot, 'apps', 'electron', 'resources', 'rox-design');
const versionsManifestPath = join(repoRoot, 'runtime-payload-versions.json');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function runCheck(args: string[] = []): ReturnType<typeof spawnSync> {
  return spawnSync('bun', ['run', scriptPath, ...args], {
    cwd: repoRoot,
    env: { ...process.env },
    encoding: 'utf-8',
    timeout: 15_000,
  });
}

// Stub required paths the script checks inside targetDir
const REQUIRED_STUBS = [
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

function populateRequiredStubs(): void {
  for (const p of REQUIRED_STUBS) {
    const full = join(targetDir, p);
    mkdirSync(require('node:path').dirname(full), { recursive: true });
    if (!existsSync(full)) writeFileSync(full, `stub:${p}`);
  }
}

function writeTargetManifest(extra: Record<string, unknown> = {}): void {
  writeFileSync(
    join(targetDir, 'MANIFEST.json'),
    JSON.stringify(
      {
        schema: 'rox-design-runtime-manifest.v1',
        version: '0.7.0-fixture',
        copiedAt: new Date().toISOString(),
        copiedPaths: ['open-design-config.json', 'app/prebundled', 'app/node_modules', 'open-design', 'open-design-web-standalone'],
        ...extra,
      },
      null,
      2,
    ) + '\n',
  );
}

function writeVersionsManifest(current: string, sha: string): void {
  writeFileSync(
    versionsManifestPath,
    JSON.stringify(
      {
        schema: 'rox-design-runtime-payload-versions.v1',
        current,
        versions: {
          [current]: {
            openDesignVersion: '0.7.0-fixture',
            preparedAt: new Date().toISOString(),
            integrationCommit: 'abc1234',
            archiveUrl: 'file:///tmp/fixture-payload.tar.gz',
            archiveSha256: sha,
            archiveSizeBytes: 1024,
          },
        },
      },
      null,
      2,
    ) + '\n',
  );
}

function removeVersionsManifest(): void {
  if (existsSync(versionsManifestPath)) rmSync(versionsManifestPath);
}

// ---------------------------------------------------------------------------
// Snapshot / restore target dir
// ---------------------------------------------------------------------------

let snapDir: string;

function snapshotTarget(): void {
  snapDir = mkdtempSync(join(tmpdir(), 'check-snap-'));
  if (existsSync(targetDir)) {
    cpSync(targetDir, snapDir, { recursive: true });
  }
}

function restoreTarget(): void {
  // Wipe all entries added during tests
  if (existsSync(targetDir)) {
    for (const entry of readdirSync(targetDir)) {
      rmSync(join(targetDir, entry), { recursive: true, force: true });
    }
  }
  // Restore snapshot entries (covers gitignored payloads that were present before)
  for (const entry of readdirSync(snapDir)) {
    cpSync(join(snapDir, entry), join(targetDir, entry), { recursive: true });
  }
  rmSync(snapDir, { recursive: true, force: true });
  // Always restore git-tracked files the test setup may have deleted
  require('node:child_process').spawnSync(
    'git',
    ['checkout', '--', 'apps/electron/resources/rox-design/'],
    { cwd: repoRoot },
  );
}

// ---------------------------------------------------------------------------
// Snapshot / restore versions manifest at repo root
// ---------------------------------------------------------------------------

let versionsManifestBackup: string | null = null;

function snapshotVersionsManifest(): void {
  versionsManifestBackup = existsSync(versionsManifestPath)
    ? readFileSync(versionsManifestPath, 'utf-8')
    : null;
}

function restoreVersionsManifest(): void {
  if (versionsManifestBackup !== null) {
    writeFileSync(versionsManifestPath, versionsManifestBackup);
  } else {
    removeVersionsManifest();
  }
}

// ---------------------------------------------------------------------------
// Global setup / teardown
// ---------------------------------------------------------------------------

beforeAll(() => {
  snapshotTarget();
  snapshotVersionsManifest();

  mkdirSync(targetDir, { recursive: true });
  populateRequiredStubs();
});

afterAll(() => {
  restoreTarget();
  restoreVersionsManifest();
});

// Ensure each test starts with a clean MANIFEST + no versions manifest
beforeEach(() => {
  // Remove MANIFEST.json and versions manifest before each test; tests write what they need
  const manifestPath = join(targetDir, 'MANIFEST.json');
  if (existsSync(manifestPath)) rmSync(manifestPath);
  removeVersionsManifest();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const FIXTURE_SHA = 'a'.repeat(64); // fake but well-formed hex sha256
const DIFFERENT_SHA = 'b'.repeat(64);
const VERSION_KEY = '0.7.0-fixture-abc1234';

describe('check-rox-design-runtime-payload.ts — no versions manifest', () => {
  test('soft mode (no --require-canonical) → cross-check skipped, exit 0', () => {
    writeTargetManifest({ archiveSha256: FIXTURE_SHA });
    // No versions manifest written
    const result = runCheck();
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('cross-check skipped');
  });

  test('--require-canonical → FAIL when no versions manifest', () => {
    writeTargetManifest({ archiveSha256: FIXTURE_SHA });
    const result = runCheck(['--require-canonical']);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('--require-canonical');
    expect(result.stderr).toContain('runtime-payload-versions.json');
  });
});

describe('check-rox-design-runtime-payload.ts — matching SHA', () => {
  test('MANIFEST.archiveSha256 matches versions[.current].archiveSha256 → exit 0', () => {
    writeTargetManifest({ archiveSha256: FIXTURE_SHA });
    writeVersionsManifest(VERSION_KEY, FIXTURE_SHA);
    const result = runCheck();
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('archiveSha256 matches');
  });
});

describe('check-rox-design-runtime-payload.ts — mismatched SHA', () => {
  test('MANIFEST.archiveSha256 differs from versions[.current] → FAIL with re-prepare command in stderr', () => {
    writeTargetManifest({ archiveSha256: DIFFERENT_SHA });
    writeVersionsManifest(VERSION_KEY, FIXTURE_SHA);
    const result = runCheck();
    expect(result.status).not.toBe(0);
    // Must include the re-prepare command hint
    expect(result.stderr).toContain('Re-prepare the payload from the canonical archive');
    expect(result.stderr).toContain('--from-archive');
    expect(result.stderr).toContain('--expected-sha256');
  });
});

describe('check-rox-design-runtime-payload.ts — --require-canonical + Mode 1 payload', () => {
  test('Mode 1 MANIFEST (no archiveSha256) + --require-canonical → FAIL', () => {
    // Mode 1: no archiveSha256 in MANIFEST, only sourceRoot
    writeTargetManifest({
      sourceRoot: '/Applications/Open Design.app/Contents/Resources',
      // archiveSha256 intentionally omitted
    });
    writeVersionsManifest(VERSION_KEY, FIXTURE_SHA);
    const result = runCheck(['--require-canonical']);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('--require-canonical');
    expect(result.stderr).toContain('Mode 1');
  });
});
