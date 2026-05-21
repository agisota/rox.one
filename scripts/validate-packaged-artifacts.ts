#!/usr/bin/env bun
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

const root = process.cwd();
const releaseDir = path.join(root, 'apps/electron/release');

/**
 * ROX_RC_MODE controls which validation mode is active:
 *   '' | undefined  → signed (default, strict, used for v1.0.x production releases)
 *   'unsigned'      → unsigned-beta mode (v1.0.0-rc.2 Mac+Windows beta artifacts)
 *
 * ROX_ARTIFACT_PLATFORM scopes validation to the artifacts produced by the
 * current workflow:
 *   unset          → host platform (darwin=mac, linux=linux, win32=windows)
 *   mac|darwin    → Mac artifacts only
 *   linux         → Linux artifacts only
 *   windows|win32 → Windows artifacts only
 *   all           → aggregate release directory validation
 */
const rcMode: string = process.env.ROX_RC_MODE ?? '';
const isUnsigned = rcMode === 'unsigned';
type ArtifactPlatform = 'mac' | 'linux' | 'windows' | 'all';

function normalizeArtifactPlatform(input: string): ArtifactPlatform {
  switch (input) {
    case 'darwin':
    case 'mac':
      return 'mac';
    case 'win32':
    case 'windows':
      return 'windows';
    case 'linux':
    case 'all':
      return input;
    default:
      fail(`unsupported ROX_ARTIFACT_PLATFORM: ${input}`);
  }
}

const hostPlatform: ArtifactPlatform =
  process.platform === 'darwin' ? 'mac' : process.platform === 'win32' ? 'windows' : 'linux';
const platformInput = (process.env.ROX_ARTIFACT_PLATFORM ?? hostPlatform).toLowerCase();
const artifactPlatform = normalizeArtifactPlatform(platformInput);
const linuxArch = process.env.ROX_LINUX_ARCH ?? 'x86_64';
const windowsArch = process.env.ROX_ARTIFACT_ARCH ?? 'x64';
const macArch = process.env.ROX_ARTIFACT_ARCH ?? 'arm64';
const MAC_MIN_SYSTEM_VERSION = '12.0';
const shouldValidateLinux = artifactPlatform === 'linux' || artifactPlatform === 'all';
const shouldValidateMac = artifactPlatform === 'mac' || artifactPlatform === 'all';
const requestedWindows = artifactPlatform === 'windows' || artifactPlatform === 'all';
const shouldValidateWindows = isUnsigned && requestedWindows;
const PRIMARY_ARTIFACT_MIN_BYTES = 50 * 1024 * 1024;
const MAC_BLOCKMAP_MIN_BYTES = 128 * 1024;
const WINDOWS_BLOCKMAP_MIN_BYTES = 64 * 1024;
const PRESENCE_MIN_BYTES = 1;

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

function plistStringValue(plist: string, key: string): string | undefined {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`<key>\\s*${escapedKey}\\s*</key>\\s*<string>([^<]+)</string>`);
  return pattern.exec(plist)?.[1]?.trim();
}

// Mirrors REQUIRED_PATHS in scripts/prepare-rox-design-runtime.ts. Kept in
// sync manually — a divergence here means the canonical archive layout
// drifted and validate-packaged-artifacts.ts must catch the missing files
// before a release ships with a half-baked Rox Design runtime.
const ROX_DESIGN_REQUIRED_PATHS: readonly string[] = [
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
];

type RoxDesignManifest = {
  schema?: string;
  mode?: string;
  archiveUrl?: string;
  version?: string;
};

function roxDesignPayloadRoot(): string | null {
  // Mac:     <release>/mac-<arch>/ROX.ONE.app/Contents/Resources/app.asar.unpacked/resources/rox-design
  // Windows: <release>/win-unpacked/resources/app.asar.unpacked/resources/rox-design
  // Linux:   <release>/linux-unpacked/resources/app.asar.unpacked/resources/rox-design
  if (artifactPlatform === 'mac') {
    return path.join(
      releaseDir,
      `mac-${macArch}/ROX.ONE.app/Contents/Resources/app.asar.unpacked/resources/rox-design`,
    );
  }
  if (artifactPlatform === 'windows') {
    return path.join(releaseDir, 'win-unpacked/resources/app.asar.unpacked/resources/rox-design');
  }
  if (artifactPlatform === 'linux') {
    return path.join(releaseDir, 'linux-unpacked/resources/app.asar.unpacked/resources/rox-design');
  }
  return null;
}

function validateRoxDesignPayload(): void {
  const payloadRoot = roxDesignPayloadRoot();
  if (!payloadRoot) return;
  // Test fixtures only materialise top-level artefact files + Info.plist,
  // never a full packaged-app tree. If `app.asar.unpacked/` itself is
  // absent, we're inspecting a fixture — skip the Rox Design payload check.
  // If `app.asar.unpacked/` exists but the rox-design directory inside it
  // is missing, that IS the bug we want to catch (payload sealed inside
  // the asar instead of unpacked) — fall through to the fail() below.
  const asarUnpackedDir = path.dirname(path.dirname(payloadRoot));
  if (!existsSync(asarUnpackedDir)) return;
  if (!existsSync(payloadRoot)) {
    fail(`missing Rox Design payload root: ${payloadRoot.replace(`${process.cwd()}/`, '')}`);
  }
  const manifestPath = path.join(payloadRoot, 'MANIFEST.json');
  if (!existsSync(manifestPath)) {
    fail(`missing Rox Design payload manifest: ${manifestPath.replace(`${process.cwd()}/`, '')}`);
  }
  let manifest: RoxDesignManifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as RoxDesignManifest;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    fail(`failed to parse Rox Design MANIFEST.json: ${reason}`);
  }
  if (manifest.schema !== 'rox-design-runtime-manifest.v1') {
    fail(
      `Rox Design MANIFEST.json schema must be rox-design-runtime-manifest.v1; got: ${String(manifest.schema)}`,
    );
  }
  if (manifest.mode !== 'from-archive') {
    fail(
      `Rox Design MANIFEST.json mode must be from-archive for releases; got: ${String(manifest.mode)}`,
    );
  }
  const missing = ROX_DESIGN_REQUIRED_PATHS.filter(
    (relativePath) => !existsSync(path.join(payloadRoot, relativePath)),
  );
  if (missing.length > 0) {
    fail(
      `Rox Design payload missing required entries under ${payloadRoot.replace(`${process.cwd()}/`, '')}:\n${missing
        .map((p) => `  - ${p}`)
        .join('\n')}`,
    );
  }
  console.log(
    `[packaged-artifacts] Rox Design payload OK (version=${manifest.version ?? 'unknown'}, mode=${manifest.mode})`,
  );
}


function assertMacMinimumSystemVersion(): void {
  const plistRelativePath = `mac-${macArch}/ROX.ONE.app/Contents/Info.plist`;
  const plistPath = path.join(releaseDir, plistRelativePath);

  if (!existsSync(plistPath)) {
    fail(`missing packaged macOS app plist: apps/electron/release/${plistRelativePath}`);
  }

  const plist = readFileSync(plistPath, 'utf8');
  const actual = plistStringValue(plist, 'LSMinimumSystemVersion');
  if (actual !== MAC_MIN_SYSTEM_VERSION) {
    fail(
      `LSMinimumSystemVersion must be ${MAC_MIN_SYSTEM_VERSION} for Monterey-and-newer compatibility; got: ${actual ?? 'missing'}`,
    );
  }

  const bundleId = plistStringValue(plist, 'CFBundleIdentifier');
  if (bundleId !== 'com.rox.one') {
    fail(`CFBundleIdentifier must be com.rox.one; got: ${bundleId ?? 'missing'}`);
  }

  console.log(`[packaged-artifacts] LSMinimumSystemVersion=${actual}`);
  console.log(`[packaged-artifacts] CFBundleIdentifier=${bundleId}`);
}

// ---------------------------------------------------------------------------
// Platform-specific requirement definitions
// ---------------------------------------------------------------------------

/**
 * Linux signed artifacts require a detached AppImage signature. The unified
 * all-platforms RC workflow can run in unsigned mode and intentionally omits
 * that sidecar.
 */
const LINUX_SIGNED_REQUIRED: Array<{ path: string; minBytes: number }> = [
  { path: `ROX-ONE-${linuxArch}.AppImage`, minBytes: PRIMARY_ARTIFACT_MIN_BYTES },
  { path: `ROX-ONE-${linuxArch}.AppImage.sig`, minBytes: PRESENCE_MIN_BYTES },
];
const LINUX_UNSIGNED_REQUIRED: Array<{ path: string; minBytes: number }> = [
  { path: `ROX-ONE-${linuxArch}.AppImage`, minBytes: PRIMARY_ARTIFACT_MIN_BYTES },
];

const LINUX_REQUIRED: Array<{ path: string; minBytes: number }> = isUnsigned
  ? LINUX_UNSIGNED_REQUIRED
  : LINUX_SIGNED_REQUIRED;
if (process.env.ROX_LINUX_DEB_RPM === 'true') {
  // electron-builder uses Debian's canonical "amd64" for .deb (even when our
  // workflow normalizes everywhere else to x86_64), while .rpm correctly uses
  // x86_64. ROX_LINUX_DEB_ARCH lets the caller override per file family —
  // defaults match what electron-builder actually writes today.
  const debArch = process.env.ROX_LINUX_DEB_ARCH ?? (linuxArch === 'x86_64' ? 'amd64' : linuxArch);
  LINUX_REQUIRED.push(
    { path: `ROX-ONE-${debArch}.deb`, minBytes: PRIMARY_ARTIFACT_MIN_BYTES },
    { path: `ROX-ONE-${linuxArch}.rpm`, minBytes: PRIMARY_ARTIFACT_MIN_BYTES },
  );
}

/**
 * Mac artifacts for signed mode (v1.0.x production).
 * Code signature is also verified below.
 */
const MAC_SIGNED_REQUIRED: Array<{ path: string; minBytes: number }> = [
  { path: `ROX-ONE-${macArch}.dmg`, minBytes: PRIMARY_ARTIFACT_MIN_BYTES },
  { path: `ROX-ONE-${macArch}.zip`, minBytes: PRIMARY_ARTIFACT_MIN_BYTES },
  { path: `ROX-ONE-${macArch}.dmg.blockmap`, minBytes: MAC_BLOCKMAP_MIN_BYTES },
  { path: `ROX-ONE-${macArch}.zip.blockmap`, minBytes: MAC_BLOCKMAP_MIN_BYTES },
  { path: 'latest-mac.yml', minBytes: PRESENCE_MIN_BYTES },
];

/**
 * Mac artifacts for unsigned-beta mode (v1.0.0-rc.2+).
 *
 * latest-mac.yml is intentionally OPTIONAL in unsigned mode: electron-builder
 * 26 with `publish: generic` + tag-context only emits it when an actual
 * publisher upload happens, which we suppress with --publish=never. The
 * aggregate manifest.json published by .github/workflows/release-all-platforms.yml
 * publish-manifest job provides equivalent metadata in unified form, so the
 * yml's absence does not break end-to-end download or auto-update flows.
 */
const MAC_UNSIGNED_REQUIRED: Array<{ path: string; minBytes: number }> = [
  { path: `ROX-ONE-${macArch}.dmg`, minBytes: PRIMARY_ARTIFACT_MIN_BYTES },
  { path: `ROX-ONE-${macArch}.zip`, minBytes: PRIMARY_ARTIFACT_MIN_BYTES },
  { path: `ROX-ONE-${macArch}.dmg.blockmap`, minBytes: MAC_BLOCKMAP_MIN_BYTES },
  { path: `ROX-ONE-${macArch}.zip.blockmap`, minBytes: MAC_BLOCKMAP_MIN_BYTES },
];

/**
 * Windows artifacts for unsigned-beta mode.
 * latest.yml is OPTIONAL — same reasoning as MAC_UNSIGNED_REQUIRED.
 */
const WINDOWS_UNSIGNED_REQUIRED: Array<{ path: string; minBytes: number }> = [
  { path: `ROX-ONE-${windowsArch}.exe`, minBytes: PRIMARY_ARTIFACT_MIN_BYTES },
  { path: `ROX-ONE-${windowsArch}.exe.blockmap`, minBytes: WINDOWS_BLOCKMAP_MIN_BYTES },
];

// ---------------------------------------------------------------------------
// Step 1 — validate required artifact presence + size
// ---------------------------------------------------------------------------

const macRequired = isUnsigned ? MAC_UNSIGNED_REQUIRED : MAC_SIGNED_REQUIRED;

if (shouldValidateLinux) {
  for (const entry of LINUX_REQUIRED) {
    assertMinSize(entry.path, entry.minBytes);
  }
}

if (shouldValidateMac) {
  for (const entry of macRequired) {
    assertMinSize(entry.path, entry.minBytes);
  }
  assertMacMinimumSystemVersion();
  validateRoxDesignPayload();
}

if (artifactPlatform === 'windows' && !isUnsigned) {
  fail('windows packaged artifact validation currently requires ROX_RC_MODE=unsigned');
}

if (shouldValidateWindows) {
  for (const entry of WINDOWS_UNSIGNED_REQUIRED) {
    assertMinSize(entry.path, entry.minBytes);
  }
  validateRoxDesignPayload();
}

if (shouldValidateLinux) {
  validateRoxDesignPayload();
}

// ---------------------------------------------------------------------------
// Step 2 — validate latest-mac.yml structure
// ---------------------------------------------------------------------------

type LatestYml = {
  files?: Array<{ url?: string; size?: number }>;
  path?: string;
};

let latestMac: LatestYml | undefined;

function latestEntryOrFail(
  latest: LatestYml,
  url: string,
  label: string,
): { url?: string; size?: number } {
  const entry = (latest.files ?? []).find((fileEntry) => fileEntry.url === url);
  if (!entry) {
    fail(`${label} missing ${url} in files[]`);
  }
  return entry;
}

if (shouldValidateMac) {
  const latestMacPath = path.join(releaseDir, 'latest-mac.yml');
  if (existsSync(latestMacPath)) {
    latestMac = yaml.load(readFileSync(latestMacPath, 'utf8')) as LatestYml;

    const urls = new Set(
      (latestMac.files ?? [])
        .map((entry) => entry.url)
        .filter((v): v is string => typeof v === 'string'),
    );
    const macZip = `ROX-ONE-${macArch}.zip`;
    const macDmg = `ROX-ONE-${macArch}.dmg`;

    if (!urls.has(macZip)) {
      fail(`latest-mac.yml missing ${macZip} in files[]`);
    }
    if (!urls.has(macDmg)) {
      fail(`latest-mac.yml missing ${macDmg} in files[]`);
    }
    if (latestMac.path !== macZip) {
      fail(`latest-mac.yml path must reference ${macZip}, got: ${String(latestMac.path)}`);
    }
  } else if (!isUnsigned) {
    fail(`missing required artifact: apps/electron/release/latest-mac.yml`);
  } else {
    console.log('[packaged-artifacts] latest-mac.yml absent (unsigned mode — optional); see manifest.json for unified metadata');
  }
}

// ---------------------------------------------------------------------------
// Step 3 — validate latest.yml presence when in unsigned mode
// ---------------------------------------------------------------------------

if (shouldValidateWindows) {
  const latestYmlPath = path.join(releaseDir, 'latest.yml');
  if (existsSync(latestYmlPath)) {
    const latestYml = yaml.load(readFileSync(latestYmlPath, 'utf8')) as LatestYml;
    const winUrls = new Set(
      (latestYml.files ?? [])
        .map((e) => e.url)
        .filter((v): v is string => typeof v === 'string'),
    );
    const installer = `ROX-ONE-${windowsArch}.exe`;
    const blockmap = `${installer}.blockmap`;

    if (latestYml.path !== installer) {
      fail(`latest.yml path must reference ${installer}, got: ${String(latestYml.path)}`);
    }
    if (!winUrls.has(installer)) fail(`latest.yml missing ${installer} in files[]`);

    const installerSize = statSync(path.join(releaseDir, installer)).size;
    const blockmapSize = statSync(path.join(releaseDir, blockmap)).size;
    const installerEntry = latestEntryOrFail(latestYml, installer, 'latest.yml');
    const blockmapEntry = (latestYml.files ?? []).find((entry) => entry.url === blockmap);

    if (installerEntry?.size !== installerSize) {
      fail(`latest.yml size for ${installer} does not match artifact on disk`);
    }
    if (blockmapEntry && blockmapEntry.size !== blockmapSize) {
      fail(`latest.yml size for ${blockmap} does not match artifact on disk`);
    }

    console.log(`[packaged-artifacts] latest.yml size[installer]=${installerEntry.size} bytes`);
    if (blockmapEntry) {
      console.log(`[packaged-artifacts] latest.yml size[blockmap]=${blockmapEntry.size} bytes`);
    } else {
      console.log(`[packaged-artifacts] latest.yml does not list ${blockmap}; validated file on disk`);
    }
    console.log('[packaged-artifacts] latest.yml artifact references verified');
  } else {
    console.log('[packaged-artifacts] latest.yml absent (unsigned mode — optional); see manifest.json for unified metadata');
  }
}

// ---------------------------------------------------------------------------
// Step 4 — signed-mode only: runtime binary + code signature verification
// ---------------------------------------------------------------------------

const dmgPath = path.join(releaseDir, `ROX-ONE-${macArch}.dmg`);
const zipPath = path.join(releaseDir, `ROX-ONE-${macArch}.zip`);

if (shouldValidateMac && !isUnsigned) {
  const packagedBunPath = path.join(
    releaseDir,
    `mac-${macArch}/ROX.ONE.app/Contents/Resources/app/vendor/bun/bun`,
  );

  if (!existsSync(packagedBunPath)) {
    fail(
      `missing packaged runtime: apps/electron/release/mac-${macArch}/ROX.ONE.app/Contents/Resources/app/vendor/bun/bun`,
    );
  }

  const fileProbe = spawnSync('file', [packagedBunPath], { encoding: 'utf8' });
  if (fileProbe.status !== 0) {
    fail(
      `failed to inspect packaged runtime with file(1): ${fileProbe.stderr.trim() || fileProbe.error?.message || 'unknown error'}`,
    );
  }
  const fileDescription = fileProbe.stdout.trim();
  if (!fileDescription.includes(`Mach-O 64-bit executable ${macArch}`)) {
    fail(`packaged runtime must be macOS ${macArch} Mach-O, got: ${fileDescription}`);
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
  if (runtimeTarget !== `darwin ${macArch}`) {
    fail(`packaged runtime target must be "darwin ${macArch}", got: ${runtimeTarget}`);
  }

  // Validate latest-mac.yml size cross-references
  const dmgStats = statSync(dmgPath);
  const zipStats = statSync(zipPath);

  if (
    (latestMac?.files ?? []).find((f) => f.url === `ROX-ONE-${macArch}.dmg`)?.size !== dmgStats.size
  ) {
    fail(`latest-mac.yml size for ROX-ONE-${macArch}.dmg does not match artifact on disk`);
  }
  if (
    (latestMac?.files ?? []).find((f) => f.url === `ROX-ONE-${macArch}.zip`)?.size !== zipStats.size
  ) {
    fail(`latest-mac.yml size for ROX-ONE-${macArch}.zip does not match artifact on disk`);
  }

  console.log(
    `[packaged-artifacts] packaged runtime ${fileProbe.stdout.trim()}`,
  );
  console.log(`[packaged-artifacts] packaged runtime probe=${runtimeTarget}`);
  console.log(
    `[packaged-artifacts] latest-mac.yml size[dmg]=${(latestMac?.files ?? []).find((f) => f.url === `ROX-ONE-${macArch}.dmg`)?.size ?? 'n/a'} bytes`,
  );
  console.log(
    `[packaged-artifacts] latest-mac.yml size[zip]=${(latestMac?.files ?? []).find((f) => f.url === `ROX-ONE-${macArch}.zip`)?.size ?? 'n/a'} bytes`,
  );
  console.log('[packaged-artifacts] latest-mac.yml artifact references verified');
} else if (shouldValidateMac && isUnsigned) {
  console.log(
    '[unsigned-beta] skipping code signature verification for mac (ROX_RC_MODE=unsigned)',
  );
}

if (shouldValidateWindows && isUnsigned) {
  console.log(
    '[unsigned-beta] skipping code signature verification for windows (ROX_RC_MODE=unsigned)',
  );
}
if (shouldValidateLinux && isUnsigned) {
  console.log(
    '[unsigned-beta] skipping AppImage signature verification for linux (ROX_RC_MODE=unsigned)',
  );
}

// ---------------------------------------------------------------------------
// Step 5 — summary output (all modes)
// ---------------------------------------------------------------------------

const allArtifacts: string[] = [
  ...(shouldValidateLinux ? LINUX_REQUIRED.map((e) => e.path) : []),
  ...(shouldValidateMac ? macRequired.map((e) => e.path) : []),
  ...(shouldValidateWindows ? WINDOWS_UNSIGNED_REQUIRED.map((e) => e.path) : []),
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
if (shouldValidateMac) {
  console.log(`[packaged-artifacts] SHA256 ROX-ONE-${macArch}.dmg ${sha256(dmgPath)}`);
  console.log(`[packaged-artifacts] SHA256 ROX-ONE-${macArch}.zip ${sha256(zipPath)}`);
  console.log(`[packaged-artifacts] latest-mac.yml path=${latestMac?.path}`);
}
if (shouldValidateWindows) {
  const installer = `ROX-ONE-${windowsArch}.exe`;
  console.log(`[packaged-artifacts] SHA256 ${installer} ${sha256(path.join(releaseDir, installer))}`);
}
console.log(`[packaged-artifacts] mode=${isUnsigned ? 'unsigned-beta' : 'signed'}`);
console.log(`[packaged-artifacts] platform=${artifactPlatform}`);
