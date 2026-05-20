/**
 * Unit tests for scripts/build-rox-design-payload-archive.ts
 *
 * Covers PR #310 (feat/rox-design-canonical-archive-build):
 *   - --dry-run against fixture source → exit 0, no tarball written
 *   - Real build (no upload, no manifest) → produces tarball + SHA-256
 *   - --versions-manifest=<path> → writes valid v1 manifest with current= pointer
 *   - Versions manifest has correct schema label
 *
 * No network calls; --upload-to is intentionally NOT set in any test.
 */
import { test, describe, expect, beforeAll, afterAll } from 'bun:test';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const repoRoot = resolve(join(import.meta.dir, '..', '..'));
const scriptPath = join(repoRoot, 'scripts', 'build-rox-design-payload-archive.ts');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function runBuildArchive(
  args: string[],
  env: Record<string, string> = {},
): ReturnType<typeof spawnSync> {
  return spawnSync('bun', ['run', scriptPath, ...args], {
    cwd: repoRoot,
    env: { ...process.env, ...env },
    encoding: 'utf-8',
    timeout: 60_000,
  });
}

// ---------------------------------------------------------------------------
// Fixture: valid source directory
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
let outputDir: string;

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
  fixtureSourceDir = mkdtempSync(join(tmpdir(), 'rox-design-build-src-'));
  buildFixtureSource(fixtureSourceDir);
  outputDir = mkdtempSync(join(tmpdir(), 'rox-design-build-out-'));
});

afterAll(() => {
  rmSync(fixtureSourceDir, { recursive: true, force: true });
  rmSync(outputDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('build-rox-design-payload-archive.ts — --dry-run', () => {
  test('--dry-run → exit 0 and no tarball written to output dir', () => {
    const result = runBuildArchive([
      `--source=${fixtureSourceDir}`,
      `--output-dir=${outputDir}`,
      '--dry-run',
    ]);
    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');

    // No tarball should have been created
    const files = readdirSync(outputDir).filter((f) => f.endsWith('.tar.gz'));
    expect(files).toHaveLength(0);

    expect(result.stdout).toContain('--dry-run');
  });
});

describe('build-rox-design-payload-archive.ts — real build', () => {
  let tarballPath: string;

  test('produces a .tar.gz tarball in the output dir', () => {
    const result = runBuildArchive([
      `--source=${fixtureSourceDir}`,
      `--output-dir=${outputDir}`,
    ]);
    expect(result.status).toBe(0);

    const tarballs = readdirSync(outputDir).filter((f) => f.endsWith('.tar.gz'));
    expect(tarballs.length).toBeGreaterThan(0);
    tarballPath = join(outputDir, tarballs[0]);
    expect(existsSync(tarballPath)).toBe(true);
  });

  test('stdout contains SHA-256 line for the produced tarball', () => {
    const result = runBuildArchive([
      `--source=${fixtureSourceDir}`,
      `--output-dir=${outputDir}`,
    ]);
    expect(result.status).toBe(0);
    // Script logs "archive SHA-256: <hex>"
    expect(result.stdout).toMatch(/archive SHA-256: [0-9a-f]{64}/);
  });

  test('tarball filename includes open-design version', () => {
    const tarballs = readdirSync(outputDir).filter((f) => f.endsWith('.tar.gz'));
    expect(tarballs.length).toBeGreaterThan(0);
    expect(tarballs[0]).toContain('0.7.0-fixture');
  });
});

describe('build-rox-design-payload-archive.ts — --versions-manifest', () => {
  let versionsManifestPath: string;

  beforeAll(() => {
    versionsManifestPath = join(outputDir, 'runtime-payload-versions.json');
  });

  test('--versions-manifest writes a v1 manifest with current= pointer', () => {
    // Clean prior manifest if any
    if (existsSync(versionsManifestPath)) rmSync(versionsManifestPath);

    const result = runBuildArchive([
      `--source=${fixtureSourceDir}`,
      `--output-dir=${outputDir}`,
      `--versions-manifest=${versionsManifestPath}`,
    ]);
    expect(result.status).toBe(0);
    expect(existsSync(versionsManifestPath)).toBe(true);

    const manifest = JSON.parse(readFileSync(versionsManifestPath, 'utf-8')) as {
      schema: string;
      current?: string;
      versions: Record<string, unknown>;
    };

    expect(manifest.schema).toBe('rox-design-runtime-payload-versions.v1');
    expect(typeof manifest.current).toBe('string');
    expect(manifest.current!.length).toBeGreaterThan(0);
    expect(manifest.versions).toBeDefined();
    expect(manifest.versions[manifest.current!]).toBeDefined();
  });

  test('versions manifest entry has required fields (archiveSha256, archiveUrl, openDesignVersion)', () => {
    if (!existsSync(versionsManifestPath)) {
      // Run build first if test is executed in isolation
      runBuildArchive([
        `--source=${fixtureSourceDir}`,
        `--output-dir=${outputDir}`,
        `--versions-manifest=${versionsManifestPath}`,
      ]);
    }

    const manifest = JSON.parse(readFileSync(versionsManifestPath, 'utf-8')) as {
      schema: string;
      current: string;
      versions: Record<
        string,
        {
          openDesignVersion: string;
          archiveUrl: string;
          archiveSha256: string;
          archiveSizeBytes: number;
          preparedAt: string;
          integrationCommit: string;
        }
      >;
    };

    const entry = manifest.versions[manifest.current];
    expect(entry).toBeDefined();
    expect(entry.openDesignVersion).toBe('0.7.0-fixture');
    expect(entry.archiveSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(typeof entry.archiveUrl).toBe('string');
    expect(entry.archiveSizeBytes).toBeGreaterThan(0);
    expect(typeof entry.preparedAt).toBe('string');
    expect(typeof entry.integrationCommit).toBe('string');
  });

  test('versions manifest schema label is exactly rox-design-runtime-payload-versions.v1', () => {
    if (!existsSync(versionsManifestPath)) {
      runBuildArchive([
        `--source=${fixtureSourceDir}`,
        `--output-dir=${outputDir}`,
        `--versions-manifest=${versionsManifestPath}`,
      ]);
    }
    const manifest = JSON.parse(readFileSync(versionsManifestPath, 'utf-8')) as { schema: string };
    expect(manifest.schema).toBe('rox-design-runtime-payload-versions.v1');
  });
});
