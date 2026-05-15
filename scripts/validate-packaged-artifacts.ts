#!/usr/bin/env bun
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

const root = process.cwd();
const releaseDir = path.join(root, 'apps/electron/release');

/**
 * ROX_RC_MODE controls which validation mode is active:
 *   '' | undefined  → signed (default, strict, used for v1.0.x production releases)
 *   'unsigned'      → unsigned-beta mode (v1.0.0-rc.2 Mac+Windows beta artifacts)
 */
const rcMode: string = process.env.ROX_RC_MODE ?? '';
const isUnsigned = rcMode === 'unsigned';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fail(message: string): never {
  console.error(`[packaged-artifacts] ${message}`);
  process.exit(1);
}

function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let idx = 0;
  while (value >= 1024 && idx < units.length - 1) {
    value /= 1024;
    idx += 1;
  }
  return `${value.toFixed(idx === 0 ? 0 : 2)} ${units[idx]}`;
}

function sha256(filePath: string): string {
  const hash = createHash('sha256');
  hash.update(readFileSync(filePath));
  return hash.digest('hex');
}

/** Returns the size of a file on disk. Calls fail() if the file is missing. */
function sizeOrFail(relativePath: string): number {
  const fullPath = path.join(releaseDir, relativePath);
  if (!existsSync(fullPath)) {
    fail(`missing required artifact: apps/electron/release/${relativePath}`);
  }
  return statSync(fullPath).size;
}

/** Asserts that a file is at least minBytes in size. */
function assertMinSize(relativePath: string, minBytes: number): void {
  const size = sizeOrFail(relativePath);
  if (size < minBytes) {
    fail(
      `artifact too small — apps/electron/release/${relativePath} is ${formatBytes(size)}, expected >= ${formatBytes(minBytes)}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Platform-specific requirement definitions
// ---------------------------------------------------------------------------

/**
 * Linux artifacts are always required regardless of mode.
 * The linux-signed-release.yml workflow GPG-signs them in every RC.
 */
const LINUX_REQUIRED: Array<{ path: string; minBytes: number }> = [
  { path: 'ROX-ONE-arm64.deb', minBytes: 50 * 1024 * 1024 },
  { path: 'ROX-ONE-arm64.rpm', minBytes: 50 * 1024 * 1024 },
  { path: 'ROX-ONE-arm64.AppImage', minBytes: 50 * 1024 * 1024 },
  { path: 'ROX-ONE-arm64.AppImage.sig', minBytes: 1 },
];

/**
 * Mac artifacts for signed mode (v1.0.x production).
 * Code signature is also verified below.
 */
const MAC_SIGNED_REQUIRED: Array<{ path: string; minBytes: number }> = [
  { path: 'ROX-ONE-arm64.dmg', minBytes: 50 * 1024 * 1024 },
  { path: 'ROX-ONE-arm64.zip', minBytes: 50 * 1024 * 1024 },
  { path: 'ROX-ONE-arm64.dmg.blockmap', minBytes: 1 * 1024 * 1024 },
  { path: 'ROX-ONE-arm64.zip.blockmap', minBytes: 1 * 1024 * 1024 },
  { path: 'latest-mac.yml', minBytes: 1 },
];

/**
 * Mac artifacts for unsigned-beta mode (v1.0.0-rc.2).
 * No code signature check — a warning is logged instead.
 */
const MAC_UNSIGNED_REQUIRED: Array<{ path: string; minBytes: number }> = [
  { path: 'ROX-ONE-arm64.dmg', minBytes: 50 * 1024 * 1024 },
  { path: 'ROX-ONE-arm64.zip', minBytes: 50 * 1024 * 1024 },
  { path: 'ROX-ONE-arm64.dmg.blockmap', minBytes: 1 * 1024 * 1024 },
  { path: 'ROX-ONE-arm64.zip.blockmap', minBytes: 1 * 1024 * 1024 },
  { path: 'latest-mac.yml', minBytes: 1 },
];

/**
 * Windows artifacts for unsigned-beta mode (v1.0.0-rc.2).
 * Windows signed mode is not implemented yet — Windows only ships in RC2+.
 */
const WINDOWS_UNSIGNED_REQUIRED: Array<{ path: string; minBytes: number }> = [
  { path: 'latest.yml', minBytes: 1 },
];

// ---------------------------------------------------------------------------
// Step 1 — validate required artifact presence + size
// ---------------------------------------------------------------------------

const macRequired = isUnsigned ? MAC_UNSIGNED_REQUIRED : MAC_SIGNED_REQUIRED;

for (const entry of [...LINUX_REQUIRED, ...macRequired]) {
  assertMinSize(entry.path, entry.minBytes);
}

if (isUnsigned) {
  // Windows Setup exe uses a glob pattern (version embedded in filename).
  // We scan for any matching file and validate size.
  const exeFiles = readdirSync(releaseDir).filter(
    (f) => f.startsWith('ROX-ONE-Setup-') && f.endsWith('.exe'),
  );
  if (exeFiles.length === 0) {
    fail('missing required artifact: apps/electron/release/ROX-ONE-Setup-*.exe');
  }
  for (const exeFile of exeFiles) {
    assertMinSize(exeFile, 50 * 1024 * 1024);
  }

  // Windows blockmap (named after the exe)
  const blockmapFiles = readdirSync(releaseDir).filter(
    (f) => f.startsWith('ROX-ONE-Setup-') && f.endsWith('.exe.blockmap'),
  );
  if (blockmapFiles.length === 0) {
    fail('missing required artifact: apps/electron/release/ROX-ONE-Setup-*.exe.blockmap');
  }
  for (const bm of blockmapFiles) {
    assertMinSize(bm, 1 * 1024 * 1024);
  }

  for (const entry of WINDOWS_UNSIGNED_REQUIRED) {
    assertMinSize(entry.path, entry.minBytes);
  }
}

// ---------------------------------------------------------------------------
// Step 2 — validate latest-mac.yml structure
// ---------------------------------------------------------------------------

const latestMacPath = path.join(releaseDir, 'latest-mac.yml');
const latestMac = yaml.load(readFileSync(latestMacPath, 'utf8')) as {
  files?: Array<{ url?: string; size?: number }>;
  path?: string;
};

const urls = new Set(
  (latestMac.files ?? [])
    .map((entry) => entry.url)
    .filter((v): v is string => typeof v === 'string'),
);

if (!urls.has('ROX-ONE-arm64.zip')) {
  fail('latest-mac.yml missing ROX-ONE-arm64.zip in files[]');
}
if (!urls.has('ROX-ONE-arm64.dmg')) {
  fail('latest-mac.yml missing ROX-ONE-arm64.dmg in files[]');
}
if (latestMac.path !== 'ROX-ONE-arm64.zip') {
  fail(`latest-mac.yml path must reference ROX-ONE-arm64.zip, got: ${String(latestMac.path)}`);
}

// ---------------------------------------------------------------------------
// Step 3 — validate latest.yml presence when in unsigned mode
// ---------------------------------------------------------------------------

if (isUnsigned) {
  const latestYmlPath = path.join(releaseDir, 'latest.yml');
  const latestYml = yaml.load(readFileSync(latestYmlPath, 'utf8')) as {
    files?: Array<{ url?: string; size?: number }>;
    path?: string;
  };
  const winUrls = new Set(
    (latestYml.files ?? [])
      .map((e) => e.url)
      .filter((v): v is string => typeof v === 'string'),
  );
  if (winUrls.size === 0) {
    fail('latest.yml has no files[] entries for Windows artifacts');
  }
}

// ---------------------------------------------------------------------------
// Step 4 — signed-mode only: runtime binary + code signature verification
// ---------------------------------------------------------------------------

const dmgPath = path.join(releaseDir, 'ROX-ONE-arm64.dmg');
const zipPath = path.join(releaseDir, 'ROX-ONE-arm64.zip');

if (!isUnsigned) {
  const packagedBunPath = path.join(
    releaseDir,
    'mac-arm64/ROX.ONE.app/Contents/Resources/app/vendor/bun/bun',
  );

  if (!existsSync(packagedBunPath)) {
    fail(
      'missing packaged runtime: apps/electron/release/mac-arm64/ROX.ONE.app/Contents/Resources/app/vendor/bun/bun',
    );
  }

  const fileProbe = spawnSync('file', [packagedBunPath], { encoding: 'utf8' });
  if (fileProbe.status !== 0) {
    fail(
      `failed to inspect packaged runtime with file(1): ${fileProbe.stderr.trim() || fileProbe.error?.message || 'unknown error'}`,
    );
  }
  const fileDescription = fileProbe.stdout.trim();
  if (!fileDescription.includes('Mach-O 64-bit executable arm64')) {
    fail(`packaged runtime must be macOS arm64 Mach-O, got: ${fileDescription}`);
  }

  const runtimeProbe = spawnSync(
    packagedBunPath,
    ['-e', 'console.log(process.platform, process.arch)'],
    { encoding: 'utf8' },
  );
  if (runtimeProbe.status !== 0) {
    fail(
      `packaged runtime failed to execute: ${runtimeProbe.stderr.trim() || runtimeProbe.error?.message || 'unknown error'}`,
    );
  }
  const runtimeTarget = runtimeProbe.stdout.trim();
  if (runtimeTarget !== 'darwin arm64') {
    fail(`packaged runtime target must be "darwin arm64", got: ${runtimeTarget}`);
  }

  // Validate latest-mac.yml size cross-references
  const dmgStats = statSync(dmgPath);
  const zipStats = statSync(zipPath);

  if (
    (latestMac.files ?? []).find((f) => f.url === 'ROX-ONE-arm64.dmg')?.size !== dmgStats.size
  ) {
    fail('latest-mac.yml size for ROX-ONE-arm64.dmg does not match artifact on disk');
  }
  if (
    (latestMac.files ?? []).find((f) => f.url === 'ROX-ONE-arm64.zip')?.size !== zipStats.size
  ) {
    fail('latest-mac.yml size for ROX-ONE-arm64.zip does not match artifact on disk');
  }

  console.log(
    `[packaged-artifacts] packaged runtime ${fileProbe.stdout.trim()}`,
  );
  console.log(`[packaged-artifacts] packaged runtime probe=${runtimeTarget}`);
  console.log(
    `[packaged-artifacts] latest-mac.yml size[dmg]=${(latestMac.files ?? []).find((f) => f.url === 'ROX-ONE-arm64.dmg')?.size ?? 'n/a'} bytes`,
  );
  console.log(
    `[packaged-artifacts] latest-mac.yml size[zip]=${(latestMac.files ?? []).find((f) => f.url === 'ROX-ONE-arm64.zip')?.size ?? 'n/a'} bytes`,
  );
  console.log('[packaged-artifacts] latest-mac.yml artifact references verified');
} else {
  console.log(
    '[unsigned-beta] skipping code signature verification for mac (ROX_RC_MODE=unsigned)',
  );
  console.log(
    '[unsigned-beta] skipping code signature verification for windows (ROX_RC_MODE=unsigned)',
  );
}

// ---------------------------------------------------------------------------
// Step 5 — summary output (all modes)
// ---------------------------------------------------------------------------

const allArtifacts: string[] = [
  ...LINUX_REQUIRED.map((e) => e.path),
  ...macRequired.map((e) => e.path),
];

console.log('[packaged-artifacts] required packaged artifacts present');
for (const relativePath of allArtifacts) {
  const fullPath = path.join(releaseDir, relativePath);
  if (!existsSync(fullPath)) continue;
  const stats = statSync(fullPath);
  console.log(
    `- apps/electron/release/${relativePath} :: ${stats.size} bytes (${formatBytes(stats.size)})`,
  );
}
console.log(`[packaged-artifacts] SHA256 ROX-ONE-arm64.dmg ${sha256(dmgPath)}`);
console.log(`[packaged-artifacts] SHA256 ROX-ONE-arm64.zip ${sha256(zipPath)}`);
console.log(`[packaged-artifacts] latest-mac.yml path=${latestMac.path}`);
console.log(`[packaged-artifacts] mode=${isUnsigned ? 'unsigned-beta' : 'signed'}`);
