#!/usr/bin/env bun
import { createReadStream, existsSync, readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';

const ROOT_DIR = join(import.meta.dir, '..');
const TARGET_DIR = resolve(ROOT_DIR, 'apps/electron/resources/rox-design');
const MANIFEST_PATH = join(TARGET_DIR, 'MANIFEST.json');
const VERSIONS_MANIFEST_PATH = resolve(ROOT_DIR, 'runtime-payload-versions.json');
const MANIFEST_SCHEMA = 'rox-design-runtime-manifest.v1';
const VERSIONS_SCHEMA = 'rox-design-runtime-payload-versions.v1';

const REQUIRED_PATHS = [
  'open-design-config.json',
  'app/prebundled/daemon/daemon-sidecar.mjs',
  'app/prebundled/daemon/daemon-cli.mjs',
  'app/node_modules/better-sqlite3',
  'app/node_modules/blake3-wasm',
  'app/prebundled/web-sidecar.mjs',
  'open-design/bin/node',
  'open-design/skills',
  'open-design/design-systems',
  'open-design/design-templates',
  'open-design/prompt-templates',
  'open-design-web-standalone/apps/web/server.js',
] as const;

interface Manifest {
  schema?: string;
  version?: string;
  sourceRoot?: string;
  archiveSource?: string;
  archiveSha256?: string;
  copiedAt?: string;
  copiedPaths?: string[];
  fileDigests?: Record<string, string>;
}

interface VersionsManifestEntry {
  openDesignVersion: string;
  archiveUrl: string;
  archiveSha256: string;
}

interface VersionsManifest {
  schema?: string;
  current?: string;
  versions?: Record<string, VersionsManifestEntry>;
}

const args = new Set(process.argv.slice(2));
const requireCanonical = args.has('--require-canonical');

function fail(message: string): never {
  console.error(`[rox-design:payload:verify] ${message}`);
  console.error('[rox-design:payload:verify]');
  console.error('[rox-design:payload:verify] Bootstrap the runtime payload before packaging:');
  console.error('[rox-design:payload:verify]   ROX_DESIGN_SOURCE_RESOURCES="<Open Design.app resources>" \\');
  console.error('[rox-design:payload:verify]     bun run rox-design:prepare -- --force');
  console.error('[rox-design:payload:verify]');
  console.error('[rox-design:payload:verify] Or from a SHA-256-pinned archive (Mode 2):');
  console.error('[rox-design:payload:verify]   bun run rox-design:prepare -- --from-archive=<url> --expected-sha256=<hex> --force');
  console.error('[rox-design:payload:verify]');
  console.error('[rox-design:payload:verify] Dev-only bypass (packaged Rox Design WILL NOT WORK):');
  console.error('[rox-design:payload:verify]   ROX_SKIP_ROX_DESIGN_PAYLOAD_VERIFY=1');
  process.exit(1);
}

if (process.env.ROX_SKIP_ROX_DESIGN_PAYLOAD_VERIFY === '1') {
  console.warn(
    '[rox-design:payload:verify] SKIPPED (ROX_SKIP_ROX_DESIGN_PAYLOAD_VERIFY=1) — packaged Rox Design will be broken.',
  );
  process.exit(0);
}

if (!existsSync(TARGET_DIR)) fail(`payload directory does not exist: ${TARGET_DIR}`);
if (!existsSync(MANIFEST_PATH)) {
  fail(`MANIFEST.json missing at ${MANIFEST_PATH} — Open Design runtime payload has not been prepared.`);
}

let manifest: Manifest;
try {
  manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as Manifest;
} catch (error) {
  fail(`MANIFEST.json is not valid JSON: ${(error as Error).message}`);
}

if (manifest.schema !== MANIFEST_SCHEMA) {
  fail(`MANIFEST.json schema mismatch: expected "${MANIFEST_SCHEMA}", got "${manifest.schema ?? 'undefined'}"`);
}
if (!manifest.version) fail('MANIFEST.json is missing "version"');

const missing = REQUIRED_PATHS.filter((relativePath) => !existsSync(join(TARGET_DIR, relativePath)));
if (missing.length > 0) {
  fail(
    `payload is incomplete (${missing.length} missing required paths):\n${missing.map((p) => `  - ${p}`).join('\n')}`,
  );
}

// PZD-51 defence-in-depth: optionally cross-check MANIFEST.json.archiveSha256
// against runtime-payload-versions.json[.current].archiveSha256. Catches:
//   - stale payload from a previous Open Design canonical archive
//   - Mode 1 (host-local) payload pushed where policy requires Mode 2
//
// Behavior:
//   - default (soft): warn if mismatch impossible (no manifest or no current=)
//     OR no archiveSha256 in target MANIFEST; FAIL on real mismatch.
//   - --require-canonical (hard): demand Mode 2 + matching versions manifest.
function crossCheckVersionsManifest(): void {
  if (!existsSync(VERSIONS_MANIFEST_PATH)) {
    if (requireCanonical) {
      fail(`--require-canonical set but runtime-payload-versions.json missing at ${VERSIONS_MANIFEST_PATH}`);
    }
    console.log('[rox-design:payload:verify] (no versions manifest at repo root; cross-check skipped)');
    return;
  }
  let versionsManifest: VersionsManifest;
  try {
    versionsManifest = JSON.parse(readFileSync(VERSIONS_MANIFEST_PATH, 'utf8')) as VersionsManifest;
  } catch (error) {
    fail(`runtime-payload-versions.json is not valid JSON: ${(error as Error).message}`);
  }

  if (versionsManifest.schema !== VERSIONS_SCHEMA) {
    fail(`runtime-payload-versions.json schema mismatch: expected "${VERSIONS_SCHEMA}", got "${versionsManifest.schema ?? 'undefined'}"`);
  }

  const current = versionsManifest.current;
  if (!current) {
    if (requireCanonical) {
      fail('--require-canonical set but runtime-payload-versions.json has no current= entry');
    }
    console.log('[rox-design:payload:verify] (versions manifest has no current= entry; cross-check skipped)');
    return;
  }

  const entry = versionsManifest.versions?.[current];
  if (!entry) fail(`runtime-payload-versions.json current="${current}" but no matching entry in versions{}`);
  if (!entry.archiveSha256) fail(`runtime-payload-versions.json[${current}] is missing archiveSha256`);

  if (!manifest.archiveSha256) {
    if (requireCanonical) {
      fail(`--require-canonical set but target MANIFEST.json has no archiveSha256 (Mode 1 payload). Re-prepare via --from-archive.`);
    }
    console.log(`[rox-design:payload:verify] (target MANIFEST has no archiveSha256; cross-check skipped — Mode 1 payload?)`);
    return;
  }

  if (manifest.archiveSha256 !== entry.archiveSha256) {
    fail(
      `archiveSha256 mismatch:\n` +
        `  target MANIFEST.json:           ${manifest.archiveSha256}\n` +
        `  runtime-payload-versions.json[${current}]: ${entry.archiveSha256}\n` +
        `\n` +
        `Re-prepare the payload from the canonical archive:\n` +
        `  ARCHIVE_URL=$(jq -r '.versions[.current].archiveUrl' runtime-payload-versions.json)\n` +
        `  ARCHIVE_SHA=$(jq -r '.versions[.current].archiveSha256' runtime-payload-versions.json)\n` +
        `  bun run rox-design:prepare -- --from-archive="$ARCHIVE_URL" --expected-sha256="$ARCHIVE_SHA" --force`,
    );
  }

  console.log(
    `[rox-design:payload:verify] archiveSha256 matches versions manifest current="${current}" (${entry.archiveSha256.slice(0, 12)}…)`,
  );
}

crossCheckVersionsManifest();

// B-H2: passive digest check — warn on missing, fail on mismatch.
async function checkFileDigests(): Promise<void> {
  const digests = manifest.fileDigests;
  if (!digests || Object.keys(digests).length === 0) {
    console.warn('[rox-design:payload:verify] (no fileDigests block in MANIFEST — tamper detection skipped; pre-B-H2 payload?)');
    return;
  }

  let mismatches = 0;
  for (const [relativePath, expectedDigest] of Object.entries(digests)) {
    const absPath = join(TARGET_DIR, relativePath);
    if (!existsSync(absPath)) {
      fail(`fileDigests: ${relativePath} listed in MANIFEST but missing from payload`);
    }
    const actual = await new Promise<string>((resolveHash, rejectHash) => {
      const hash = createHash('sha256');
      const stream = createReadStream(absPath);
      stream.on('data', (chunk: Buffer) => hash.update(chunk));
      stream.on('end', () => resolveHash(hash.digest('hex')));
      stream.on('error', rejectHash);
    });
    if (actual !== expectedDigest) {
      console.error(
        `[rox-design:payload:verify] digest MISMATCH: ${relativePath}\n` +
          `  expected: ${expectedDigest}\n` +
          `  actual:   ${actual}`,
      );
      mismatches += 1;
    }
  }

  if (mismatches > 0) {
    fail(`fileDigests: ${mismatches} file(s) failed digest verification — payload may have been tampered with`);
  }

  console.log(`[rox-design:payload:verify] fileDigests OK (${Object.keys(digests).length} files verified)`);
}

await checkFileDigests();

const topLevel = readdirSync(TARGET_DIR).filter((entry) => entry !== '.DS_Store');
console.log(`[rox-design:payload:verify] OK — Open Design ${manifest.version} payload at ${TARGET_DIR}`);
console.log(
  `[rox-design:payload:verify] sourceRoot=${manifest.sourceRoot ?? '<unknown>'} archiveSource=${manifest.archiveSource ?? '<unknown>'} copiedAt=${manifest.copiedAt ?? '<unknown>'}`,
);
console.log(`[rox-design:payload:verify] top-level entries: ${topLevel.join(', ')}`);
