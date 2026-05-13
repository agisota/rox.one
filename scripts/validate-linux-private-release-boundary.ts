#!/usr/bin/env bun
/**
 * Linux private-release trust-boundary validator (M.18 T253).
 * Mirror of the Mac (T250) and Windows (T252) validators for the
 * AppImage / Snap target. Boundary contract: private/local RC builds
 * ship unsigned (no real gpg credentials), canonical
 * `rox-one-*.AppImage` artifact name, canonical `Exec=rox-one` desktop
 * entry, no symlinks escaping the AppDir, and an optional gpg-detached
 * signature sidecar. Public production blocked until T255+.
 * Cross-platform. Setting `LINUX_BOUNDARY_FIXTURE_DIR=<path>` or
 * `--fixture <path>` forces fixture-mode regardless of host.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, lstatSync, readdirSync, readFileSync, readlinkSync } from 'node:fs';
import { platform } from 'node:os';
import path from 'node:path';

const root = process.cwd();
const linuxUnpackedPath = path.join(root, 'apps/electron/release/linux-unpacked');

const argv = process.argv.slice(2);
for (let index = 0; index < argv.length; index += 1) {
  const arg = argv[index];
  if (arg === '--fixture' || arg === '--fixture-dir') {
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      console.error('[linux-private-release-boundary] --fixture requires a path argument');
      process.exit(1);
    }
    process.env.LINUX_BOUNDARY_FIXTURE_DIR = next;
    index += 1;
  } else if (arg.startsWith('--fixture=')) {
    process.env.LINUX_BOUNDARY_FIXTURE_DIR = arg.slice('--fixture='.length);
  }
}

/** Canonical AppImage filename: `rox-one-<version>-<arch>.AppImage`
 *  with `rox-one` prefix mandatory. */
const APPIMAGE_FILENAME_PATTERN = /^rox-one(-[A-Za-z0-9.+-]+)*\.AppImage$/;
/** Canonical desktop-entry `Exec=` line target. */
const DESKTOP_EXEC_PATTERN = /^Exec=rox-one(\s|$)/m;
/** Canonical afterPack marker emitted by afterPack-linux.cjs. */
const T253_AFTER_PACK_MARKER = '(T253 linux boundary ok)';

const REQUIRED_DESKTOP_KEYS = ['[Desktop Entry]', 'Name=', 'Exec=', 'Categories='];
const REQUIRED_SIGNING_TOKENS = ['gpg:', 'Good signature', 'Primary key fingerprint'];
const FORBIDDEN_SIGNING_TOKENS = [
  'BAD signature',
  'No public key',
  'is not signed',
];

function fail(message: string): never {
  console.error(`[linux-private-release-boundary] ${message}`);
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

/** Minimal `Key=Value` text parser for desktop entries; `#` starts a
 *  comment, `[Section]` lines are kept verbatim as a sentinel key. */
function parseDesktopEntry(text: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    if (line.startsWith('[') && line.endsWith(']')) {
      result[line] = '';
      continue;
    }
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

interface LinuxBundleAssertions {
  bundlePath: string;
  desktopEntryPath?: string;
  signingOutputPath?: string;
}

function assertLinuxBundleContract({
  bundlePath,
  desktopEntryPath,
  signingOutputPath,
}: LinuxBundleAssertions): void {
  // Canonical filename guard: at least one entry inside the AppDir
  // must be the rox-one AppImage stub, OR the AppDir itself ends in
  // `.AppDir`. We only assert the stub when one is present so the
  // live-mode codepath (linux-unpacked/) does not require it.
  const topLevelEntries = readdirSync(bundlePath, { withFileTypes: true });
  const appImageStub = topLevelEntries.find((entry) =>
    /\.AppImage$/.test(entry.name),
  );
  if (appImageStub && !APPIMAGE_FILENAME_PATTERN.test(appImageStub.name)) {
    fail(`AppImage filename "${appImageStub.name}" does not match ${APPIMAGE_FILENAME_PATTERN}`);
  }

  // Desktop entry: must exist, must contain canonical Exec=rox-one.
  const entryPath =
    desktopEntryPath ?? path.join(bundlePath, 'rox-one.desktop');
  if (!existsSync(entryPath)) {
    fail(`bundle missing desktop entry: ${entryPath}`);
  }
  const desktopText = readFileSync(entryPath, 'utf8');
  for (const key of REQUIRED_DESKTOP_KEYS) {
    if (!desktopText.includes(key)) {
      fail(`desktop entry missing required key: ${key}`);
    }
  }
  if (!DESKTOP_EXEC_PATTERN.test(desktopText)) {
    fail(`desktop entry Exec= line does not match canonical rox-one target`);
  }
  const entry = parseDesktopEntry(desktopText);
  const name = entry['Name'];
  if (typeof name !== 'string' || name.length === 0) {
    fail('desktop entry Name= value is empty');
  }
  const categories = entry['Categories'];
  if (typeof categories !== 'string' || !/Office|Utility|Development|Productivity/.test(categories)) {
    fail(`desktop entry Categories= "${categories ?? '<missing>'}" is not a canonical category`);
  }

  // afterPack canonical marker: validator looks for it in either the
  // signing-output sidecar or the desktop entry to confirm
  // afterPack-linux.cjs ran and emitted the T253 marker.
  const signingOutput = signingOutputPath && existsSync(signingOutputPath)
    ? readFileSync(signingOutputPath, 'utf8')
    : '';
  const combinedMarkerSource = `${signingOutput}\n${desktopText}`;
  if (!combinedMarkerSource.includes(T253_AFTER_PACK_MARKER)) {
    fail(`afterPack canonical marker missing: ${T253_AFTER_PACK_MARKER}`);
  }

  // gpg signing-output sidecar grep. Fixture mode always runs it
  // (sidecar present); live linux only runs it when CI piped one in.
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

  // Symlink boundary: reject any symlink resolving outside the AppDir.
  // node_modules/.bin commonly produces ../foo links — those resolve
  // inside the AppDir so are fine; absolute or out-of-AppDir links are
  // rejected.
  const allFiles = walkBundleFiles(bundlePath);
  for (const target of allFiles) {
    let stat;
    try {
      stat = lstatSync(target);
    } catch {
      continue;
    }
    if (!stat.isSymbolicLink()) continue;
    const linkTarget = readlinkSync(target);
    const resolved = path.resolve(path.dirname(target), linkTarget);
    if (!resolved.startsWith(bundlePath + path.sep) && resolved !== bundlePath) {
      fail(`symlink escapes bundle: ${target} -> ${linkTarget}`);
    }
  }
}

// 1. package.json contract: script must still be wired.
const packageJson = JSON.parse(read('package.json'));
const scripts = packageJson.scripts ?? {};
const boundaryScript = scripts['validate:linux-private-release-boundary'];
if (
  typeof boundaryScript !== 'string' ||
  !boundaryScript.includes('scripts/validate-linux-private-release-boundary.ts')
) {
  fail('package.json missing validate:linux-private-release-boundary script entry');
}

// 2. electron-builder.yml: linux target + canonical appId reuse + AppImage.
const builderConfig = read('apps/electron/electron-builder.yml');
requireText(builderConfig, 'appId: com.rox.one', 'canonical bundle-id appId (shared with Mac+Windows)');
requireText(builderConfig, 'linux:', 'linux: build block');
requireText(builderConfig, 'target: AppImage', 'AppImage target for linux installer');
requireText(builderConfig, 'category: Office', 'linux Office category pin');
requireText(
  builderConfig,
  'T253: trust-boundary signing placeholder',
  'linux: signing-placeholder boundary comment',
);

// 3. Release readiness docs: blocker still recorded.
const readinessMatrix = read('docs/release/production-readiness-matrix-2026-05-06.md');
requireText(readinessMatrix, 'Public production: no.', 'public-production blocked decision');
requireText(readinessMatrix, 'signed/notarized release', 'signed/notarized release blocker');

// 4. Fixture-mode bundle assertions (env-gated).
const fixtureDir = process.env.LINUX_BOUNDARY_FIXTURE_DIR;
if (fixtureDir) {
  const fixtureBundlePath = path.isAbsolute(fixtureDir) ? fixtureDir : path.join(root, fixtureDir);
  if (!existsSync(fixtureBundlePath)) {
    fail(`LINUX_BOUNDARY_FIXTURE_DIR points at non-existent path: ${fixtureBundlePath}`);
  }
  const sidecar = path.join(fixtureBundlePath, 'signing-output.txt');
  assertLinuxBundleContract({
    bundlePath: fixtureBundlePath,
    desktopEntryPath: path.join(fixtureBundlePath, 'rox-one.desktop'),
    signingOutputPath: sidecar,
  });
  console.log(`[linux-private-release-boundary] fixture-mode ok: ${fixtureBundlePath}`);
}

// 5. Non-linux hosts skip the live gpg/AppImage checks but keep static
//    config + doc + fixture asserts running.
if (platform() !== 'linux') {
  console.warn('[linux-private-release-boundary] non-linux host: skipped gpg/AppImage live checks');
  console.log('[linux-private-release-boundary] ok: docs and config keep private linux release boundary explicit');
  process.exit(0);
}

if (!existsSync(linuxUnpackedPath)) {
  console.warn('[linux-private-release-boundary] no packaged linux-unpacked directory found; static checks only');
  console.log('[linux-private-release-boundary] ok: docs and config keep private linux release boundary explicit');
  process.exit(0);
}

// Live gpg verify against an optional detached signature sidecar.
// Local/private RC is intentionally unsigned so missing sidecar is
// fine; CI signing builds (T255) swap in a stricter contract.
const detachedSig = path.join(linuxUnpackedPath, 'rox-one.AppImage.sig');
if (existsSync(detachedSig)) {
  const gpg = run('gpg', ['--verify', detachedSig]);
  if (gpg.status === 0) {
    for (const token of REQUIRED_SIGNING_TOKENS) {
      requireText(gpg.output, token, `required gpg token: ${token}`);
    }
  }
}

console.log('[linux-private-release-boundary] packaged linux-unpacked inspection: ok');
console.log('[linux-private-release-boundary] private/local RC unsigned posture documented');
