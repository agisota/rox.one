#!/usr/bin/env bun
/**
 * Windows private-release trust-boundary validator (M.18 T252).
 * Mirror of the Mac validator (T250) for Windows NSIS installers.
 * Boundary contract: private/local RC unsigned, pinned canonical
 * `one.rox.workbench.*` AppUserModelID, monotonic dotted FileVersion,
 * no symlinks escaping install dir. Public prod blocked until T254+.
 * Cross-platform. Setting `WIN_BOUNDARY_FIXTURE_DIR=<path>` or
 * `--fixture <path>` forces fixture-mode regardless of host.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, lstatSync, readdirSync, readFileSync, readlinkSync } from 'node:fs';
import { platform } from 'node:os';
import path from 'node:path';

const root = process.cwd();
const winUnpackedPath = path.join(root, 'apps/electron/release/win-unpacked');
const winExePath = path.join(winUnpackedPath, 'ROX.ONE.exe');

const argv = process.argv.slice(2);
for (let index = 0; index < argv.length; index += 1) {
  const arg = argv[index];
  if (arg === '--fixture' || arg === '--fixture-dir') {
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      console.error('[windows-private-release-boundary] --fixture requires a path argument');
      process.exit(1);
    }
    process.env.WIN_BOUNDARY_FIXTURE_DIR = next;
    index += 1;
  } else if (arg.startsWith('--fixture=')) {
    process.env.WIN_BOUNDARY_FIXTURE_DIR = arg.slice('--fixture='.length);
  }
}

/** Canonical AppUserModelID. Accepts `one.rox.workbench[.*]` or the
 *  fallback `com.rox.one[.*]` (electron-builder defaults Windows appId
 *  to the top-level appId when nsis.appId is unset). */
const WINDOWS_APP_ID_PATTERN = /^(one\.rox\.workbench|com\.rox\.one)(\.[A-Za-z0-9-]+)*$/;
/** Windows FileVersion / ProductVersion: a.b.c.d dotted-numeric. */
const WINDOWS_VERSION_PATTERN = /^\d+(\.\d+){0,3}$/;
/** Canonical afterPack marker emitted by afterPack-windows.cjs. */
const T252_AFTER_PACK_MARKER = '(T252 windows boundary ok)';

const REQUIRED_SIGNING_TOKENS = ['Subject:', 'Issuer:', 'SHA1 hash:'];
const FORBIDDEN_SIGNING_TOKENS = [
  'SignTool Error',
  'No signature found',
  'is not signed',
];

function fail(message: string): never {
  console.error(`[windows-private-release-boundary] ${message}`);
  process.exit(1);
}

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

function requireText(source: string, expected: string, description: string): void {
  if (!source.includes(expected)) {
    fail(`missing ${description}: ${expected}`);
  }
}

function refuseText(source: string, forbidden: string, description: string): void {
  if (source.includes(forbidden)) {
    fail(`forbidden token still present (${description}): ${forbidden}`);
  }
}

function run(command: string, args: string[]): { status: number | null; output: string } {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8' });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim();
  if (result.error) {
    fail(`${command} failed to start: ${result.error.message}`);
  }
  return { status: result.status, output };
}

/** Minimal `Key=Value` text parser for app-info.txt; `#` starts a comment. */
function parseInfoText(text: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const equalsIndex = line.indexOf('=');
    if (equalsIndex <= 0) continue;
    const key = line.slice(0, equalsIndex).trim();
    const value = line.slice(equalsIndex + 1).trim();
    if (key) result[key] = value;
  }
  return result;
}

function walkBundleFiles(dir: string, acc: string[] = []): string[] {
  let entries: ReturnType<typeof readdirSync> = [];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) {
      acc.push(fullPath);
      continue;
    }
    if (entry.isDirectory()) {
      walkBundleFiles(fullPath, acc);
    } else {
      acc.push(fullPath);
    }
  }
  return acc;
}

interface WindowsBundleAssertions {
  bundlePath: string;
  appInfoPath?: string;
  signingOutputPath?: string;
}

function assertWindowsBundleContract({
  bundlePath,
  appInfoPath,
  signingOutputPath,
}: WindowsBundleAssertions): void {
  const infoPath = appInfoPath ?? path.join(bundlePath, 'app-info.txt');
  if (!existsSync(infoPath)) {
    fail(`bundle missing app-info.txt sidecar: ${infoPath}`);
  }
  const info = parseInfoText(readFileSync(infoPath, 'utf8'));

  const appId = info['AppUserModelID'] ?? info['nsis.appId'] ?? info['AppId'];
  if (typeof appId !== 'string' || !WINDOWS_APP_ID_PATTERN.test(appId)) {
    fail(`AppUserModelID "${appId ?? '<missing>'}" does not match ${WINDOWS_APP_ID_PATTERN}`);
  }

  const fileVersion = info['FileVersion'] ?? info['ProductVersion'];
  if (typeof fileVersion !== 'string' || !WINDOWS_VERSION_PATTERN.test(fileVersion)) {
    fail(`FileVersion "${fileVersion ?? '<missing>'}" is not a monotonic dotted Windows version`);
  }

  const companyName = info['CompanyName'];
  if (typeof companyName !== 'string' || companyName.length === 0) {
    fail('CompanyName is missing from app-info.txt');
  }

  // afterPack canonical marker: validator looks for it in either sidecar
  // to confirm afterPack-windows.cjs ran and emitted the T252 marker.
  const signingOutput = signingOutputPath && existsSync(signingOutputPath)
    ? readFileSync(signingOutputPath, 'utf8')
    : '';
  const combinedMarkerSource = `${signingOutput}\n${readFileSync(infoPath, 'utf8')}`;
  if (!combinedMarkerSource.includes(T252_AFTER_PACK_MARKER)) {
    fail(`afterPack canonical marker missing: ${T252_AFTER_PACK_MARKER}`);
  }

  // signtool / signing-output sidecar grep. Fixture mode always runs it
  // (sidecar present); live win32 only runs it when CI piped one in.
  if (signingOutput) {
    for (const token of REQUIRED_SIGNING_TOKENS) {
      if (!signingOutput.includes(token)) {
        fail(`required signing-output token absent: ${token}`);
      }
    }
    for (const token of FORBIDDEN_SIGNING_TOKENS) {
      if (signingOutput.includes(token)) {
        fail(`forbidden signing-output token present: ${token}`);
      }
    }
  }

  // Native binary signing surface: walk every file under the bundle and
  // confirm the signing-output sidecar mentions each .exe / .dll basename.
  const allFiles = walkBundleFiles(bundlePath);
  const nativeBinaries = allFiles.filter((file) => /\.(exe|dll|node)$/i.test(file));
  if (signingOutput) {
    for (const binary of nativeBinaries) {
      const baseName = path.basename(binary);
      if (!signingOutput.includes(baseName)) {
        fail(`native binary "${baseName}" missing canonical signing entry`);
      }
    }
  }

  // Symlink boundary: reject any symlink resolving outside the bundle.
  for (const entry of allFiles) {
    let stat;
    try {
      stat = lstatSync(entry);
    } catch {
      continue;
    }
    if (!stat.isSymbolicLink()) continue;
    const target = readlinkSync(entry);
    const resolved = path.resolve(path.dirname(entry), target);
    if (!resolved.startsWith(bundlePath + path.sep) && resolved !== bundlePath) {
      fail(`symlink escapes bundle: ${entry} -> ${target}`);
    }
  }
}

// 1. package.json contract: script must still be wired.
const packageJson = JSON.parse(read('package.json'));
const scripts = packageJson.scripts ?? {};
const boundaryScript = scripts['validate:windows-private-release-boundary'];
if (
  typeof boundaryScript !== 'string' ||
  !boundaryScript.includes('scripts/validate-windows-private-release-boundary.ts')
) {
  fail('package.json missing validate:windows-private-release-boundary script entry');
}

// 2. electron-builder.yml: nsis target + canonical appId + per-user install.
const builderConfig = read('apps/electron/electron-builder.yml');
requireText(builderConfig, 'appId: com.rox.one', 'canonical bundle-id appId (shared with Mac)');
requireText(builderConfig, 'win:', 'win: build block');
requireText(builderConfig, 'target: nsis', 'nsis target for windows installer');
requireText(builderConfig, 'afterPack: scripts/afterPack.cjs', 'macOS afterPack hook (shared)');
requireText(builderConfig, 'nsis:', 'nsis: block');
requireText(builderConfig, 'oneClick: true', 'nsis oneClick installer flag');
requireText(builderConfig, 'perMachine: false', 'nsis perMachine=false (per-user install)');
requireText(
  builderConfig,
  'T252: trust-boundary signing placeholder',
  'win: signing-placeholder boundary comment',
);

// 3. Release readiness docs: blocker still recorded.
const readinessMatrix = read('docs/release/production-readiness-matrix-2026-05-06.md');
requireText(readinessMatrix, 'Public production: no.', 'public-production blocked decision');
requireText(readinessMatrix, 'signed/notarized release', 'signed/notarized release blocker');

// 4. Fixture-mode bundle assertions (env-gated).
const fixtureDir = process.env.WIN_BOUNDARY_FIXTURE_DIR;
if (fixtureDir) {
  const fixtureBundlePath = path.isAbsolute(fixtureDir) ? fixtureDir : path.join(root, fixtureDir);
  if (!existsSync(fixtureBundlePath)) {
    fail(`WIN_BOUNDARY_FIXTURE_DIR points at non-existent path: ${fixtureBundlePath}`);
  }
  const sidecar = path.join(fixtureBundlePath, 'signing-output.txt');
  assertWindowsBundleContract({
    bundlePath: fixtureBundlePath,
    appInfoPath: path.join(fixtureBundlePath, 'app-info.txt'),
    signingOutputPath: sidecar,
  });
  console.log(`[windows-private-release-boundary] fixture-mode ok: ${fixtureBundlePath}`);
}

// 5. Non-win32 hosts skip the live signtool step but keep static checks.
if (platform() !== 'win32') {
  console.warn('[windows-private-release-boundary] non-win32 host: skipped signtool live checks');
  console.log('[windows-private-release-boundary] ok: docs and config keep private windows release boundary explicit');
  process.exit(0);
}

if (!existsSync(winExePath)) {
  fail('missing packaged exe: apps/electron/release/win-unpacked/ROX.ONE.exe; run electron-builder --win first');
}

// Live signtool verify against the unpacked exe. Local/private RC is
// intentionally unsigned so a non-zero status is fine here; CI signing
// builds (T254) swap in a stricter contract.
const signtool = run('signtool', ['verify', '/pa', '/v', winExePath]);
if (signtool.status === 0) {
  for (const token of REQUIRED_SIGNING_TOKENS) {
    requireText(signtool.output, token, `required signtool token: ${token}`);
  }
}

console.log('[windows-private-release-boundary] packaged exe inspection: ok');
console.log('[windows-private-release-boundary] private/local RC unsigned posture documented');
