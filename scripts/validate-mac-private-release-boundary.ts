#!/usr/bin/env bun
/**
 * Mac private-release trust-boundary validator (M.18 T250).
 *
 * Boundary contract:
 *  - Private/local RC builds: ad-hoc signed, not notarized, hardened runtime ON,
 *    minimal entitlements (no library-validation disable, no network server).
 *  - Public production: blocked until signed/notarized pipeline lands (T261+).
 *
 * Runs cross-platform: the static config/doc + entitlements + fixture checks
 * always execute. On darwin the live codesign + stapler checks layer on top.
 * Setting `MAC_BOUNDARY_FIXTURE_DIR=<path>` forces fixture-mode bundle checks
 * regardless of host (used by `scripts/__tests__/`).
 */
import { spawnSync } from 'node:child_process';
import { existsSync, lstatSync, readdirSync, readFileSync, readlinkSync, statSync } from 'node:fs';
import { platform } from 'node:os';
import path from 'node:path';

const root = process.cwd();
const appPath = path.join(root, 'apps/electron/release/mac-arm64/ROX.ONE.app');

/** T251: support `--fixture <path>` as a CLI alternative to the
 *  MAC_BOUNDARY_FIXTURE_DIR env var. The CLI form is what
 *  `validate:mac-boundary-fixtures` and bun-test invocations use; the env
 *  var stays supported for backwards compatibility. */
const argv = process.argv.slice(2);
for (let index = 0; index < argv.length; index += 1) {
  const arg = argv[index];
  if (arg === '--fixture' || arg === '--fixture-dir') {
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      console.error('[mac-private-release-boundary] --fixture requires a path argument');
      process.exit(1);
    }
    process.env.MAC_BOUNDARY_FIXTURE_DIR = next;
    index += 1;
  } else if (arg.startsWith('--fixture=')) {
    process.env.MAC_BOUNDARY_FIXTURE_DIR = arg.slice('--fixture='.length);
  }
}

/** Canonical bundle-id pattern. `com.rox.one` is the registered base scope;
 *  helper apps and downstream tools may extend with `.helper`, etc. */
const BUNDLE_ID_PATTERN = /^com\.rox\.one(\.[A-Za-z0-9-]+)*$/;
const REQUIRED_CLIENT_ENTITLEMENTS = new Set(['com.apple.security.network.client']);
const FORBIDDEN_ENTITLEMENTS = new Set([
  'com.apple.security.cs.disable-library-validation',
  'com.apple.security.network.server',
  'com.apple.security.cs.allow-dyld-environment-variables',
]);

function fail(message: string): never {
  console.error(`[mac-private-release-boundary] ${message}`);
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

function assertCodesignIdentifier(codesignOutput: string): void {
  const match = /^Identifier=(.+)$/m.exec(codesignOutput);
  const identifier = match?.[1]?.trim();
  // Ad-hoc app signing on CircleCI can report the CodeDirectory identifier as
  // the executable name even while Info.plist keeps the canonical bundle id.
  const acceptedIdentifiers = new Set(['com.rox.one', 'ROX.ONE']);
  if (!identifier || !acceptedIdentifiers.has(identifier)) {
    fail(
      `missing ROX.ONE code signing identifier: Identifier=com.rox.one ` +
        `(observed ${identifier ?? '<missing>'})`,
    );
  }
}

/** Minimal plist parser sufficient for this validator. Reads <key>/<value>
 *  pairs from an XML plist and returns a flat map. Handles `<string>`,
 *  `<true/>`, `<false/>`, and `<integer>`. */
function parsePlist(text: string): Record<string, string | boolean | number> {
  const result: Record<string, string | boolean | number> = {};
  const pattern = /<key>([^<]+)<\/key>\s*(<true\/>|<false\/>|<string>([^<]*)<\/string>|<integer>(-?\d+)<\/integer>)/g;
  for (const match of text.matchAll(pattern)) {
    const key = match[1];
    const tag = match[2];
    if (tag.startsWith('<true')) result[key] = true;
    else if (tag.startsWith('<false')) result[key] = false;
    else if (tag.startsWith('<string')) result[key] = match[3] ?? '';
    else if (tag.startsWith('<integer')) result[key] = Number(match[4]);
  }
  return result;
}

function isAppleBuildNumber(value: unknown): boolean {
  if (typeof value === 'number') return Number.isInteger(value) && value >= 0;
  if (typeof value !== 'string' || value.length === 0) return false;
  // Apple accepts dotted numerics (e.g. "1.2.3.4"). Reject if any segment non-numeric.
  return value.split('.').every((seg) => seg.length > 0 && /^\d+$/.test(seg));
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

interface BundleAssertions {
  bundlePath: string;
  /** Optional path to a sidecar `signing-output.txt` for fixture mode. */
  signingOutputPath?: string;
  /** Optional live codesign output for runtime/entitlement checks. */
  signingOutputText?: string;
  /** Fixture sidecars list every binary; live top-level codesign output does not. */
  requireNativeBinaryEntries?: boolean;
}

function assertBundleContract({
  bundlePath,
  signingOutputPath,
  signingOutputText,
  requireNativeBinaryEntries,
}: BundleAssertions): void {
  const infoPlistPath = path.join(bundlePath, 'Contents', 'Info.plist');
  if (!existsSync(infoPlistPath)) {
    fail(`bundle missing Info.plist: ${infoPlistPath}`);
  }
  const infoPlist = parsePlist(readFileSync(infoPlistPath, 'utf8'));

  const bundleId = infoPlist['CFBundleIdentifier'];
  if (typeof bundleId !== 'string' || !BUNDLE_ID_PATTERN.test(bundleId)) {
    fail(`CFBundleIdentifier "${bundleId ?? '<missing>'}" does not match ${BUNDLE_ID_PATTERN}`);
  }
  const buildNumber = infoPlist['CFBundleVersion'];
  if (!isAppleBuildNumber(buildNumber)) {
    fail(`CFBundleVersion "${buildNumber ?? '<missing>'}" is not a monotonic Apple build number`);
  }

  // Hardened-runtime flag: electron-builder writes a top-level boolean key
  // when hardenedRuntime: true. Some toolchains emit it inside the signed
  // entitlements blob instead — accept either source.
  const hardenedFromInfo =
    infoPlist['HardenedRuntime'] === true ||
    infoPlist['com.apple.security.cs.hardened-runtime'] === true;
  const signingOutput = signingOutputText ?? (signingOutputPath && existsSync(signingOutputPath)
    ? readFileSync(signingOutputPath, 'utf8')
    : '');
  const hardenedFromSigning = /flags=0x[0-9a-fA-F]*10000\b/.test(signingOutput) ||
    signingOutput.includes('runtime');
  if (!hardenedFromInfo && !hardenedFromSigning) {
    fail('hardened runtime flag missing from Info.plist and signing output');
  }

  // Entitlements presence: REQUIRED present, FORBIDDEN absent.
  if (signingOutput) {
    for (const key of REQUIRED_CLIENT_ENTITLEMENTS) {
      if (!signingOutput.includes(key)) {
        fail(`required entitlement absent from signing output: ${key}`);
      }
    }
    for (const key of FORBIDDEN_ENTITLEMENTS) {
      if (signingOutput.includes(`<key>${key}</key>`)) {
        fail(`forbidden entitlement present in signing output: ${key}`);
      }
    }
  }

  // Native binary signing surface: walk every file under Contents/, detect
  // dylibs/.node modules, and confirm fixture sidecar or codesign output
  // mentions each one (in fixture mode the sidecar lists their basenames).
  const contentsDir = path.join(bundlePath, 'Contents');
  const allFiles = walkBundleFiles(contentsDir);
  const nativeBinaries = allFiles.filter((file) =>
    /\.(dylib|node|framework)$/.test(file) || /\/MacOS\//.test(file),
  );
  const mustCheckNativeBinaryEntries = requireNativeBinaryEntries ?? Boolean(signingOutputPath);
  if (signingOutput && mustCheckNativeBinaryEntries) {
    for (const binary of nativeBinaries) {
      const baseName = path.basename(binary);
      if (!signingOutput.includes(baseName)) {
        fail(`native binary "${baseName}" missing canonical signing entry`);
      }
    }
  }

  // Symlink boundary: every symlink under Contents/Resources must resolve
  // inside the bundle. node_modules/.bin commonly produces ../foo links —
  // those resolve inside Resources so are fine; absolute or out-of-bundle
  // links are rejected.
  const resourcesDir = path.join(bundlePath, 'Contents', 'Resources');
  const resourceEntries = walkBundleFiles(resourcesDir);
  for (const entry of resourceEntries) {
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

// 1. Package.json contract: script must still be wired.
const packageJson = JSON.parse(read('package.json'));
const scripts = packageJson.scripts ?? {};
const boundaryScript = scripts['validate:mac-private-release-boundary'];
if (
  typeof boundaryScript !== 'string' ||
  !boundaryScript.includes('scripts/validate-mac-private-release-boundary.ts')
) {
  fail('package.json missing validate:mac-private-release-boundary script entry');
}

// 2. electron-builder yml: hardened runtime + ad-hoc local-RC posture.
const builderConfig = read('apps/electron/electron-builder.yml');
requireText(builderConfig, 'asar: false', 'documented local-RC ASAR-disabled setting');
requireText(
  builderConfig,
  'Code signing & notarization (disabled by default for local builds)',
  'local signing/notarization boundary comment',
);
requireText(builderConfig, 'CSC_LINK', 'production signing credential hint');
requireText(builderConfig, 'APPLE_TEAM_ID', 'production notarization team hint');
requireText(builderConfig, 'hardenedRuntime: true', 'hardenedRuntime electron-builder flag');
requireText(builderConfig, 'entitlements: build/entitlements.mac.plist', 'entitlements file reference');
requireText(builderConfig, 'appId: com.rox.one', 'canonical bundle-id appId');

// 3. Entitlements plist: hardened minimum surface.
const entitlements = read('apps/electron/build/entitlements.mac.plist');
requireText(entitlements, '<key>com.apple.security.cs.allow-jit</key>', 'JIT entitlement');
requireText(
  entitlements,
  '<key>com.apple.security.network.client</key>',
  'outbound-network entitlement',
);
refuseText(
  entitlements,
  '<key>com.apple.security.cs.disable-library-validation</key>',
  'disable-library-validation is dropped in T250',
);
refuseText(
  entitlements,
  '<key>com.apple.security.network.server</key>',
  'no inbound-network entitlement allowed',
);
refuseText(
  entitlements,
  '<key>com.apple.security.cs.allow-dyld-environment-variables</key>',
  'no dyld env-variable entitlement allowed',
);

// 4. Release readiness docs.
const readinessMatrix = read('docs/release/production-readiness-matrix-2026-05-06.md');
requireText(readinessMatrix, 'Public production: no.', 'public-production blocked decision');
requireText(readinessMatrix, 'signed/notarized release', 'signed/notarized release blocker');

const finalRc = read('docs/release/final-rc-2026-05-06.md');
requireText(finalRc, 'Public production launch status: blocked', 'final RC public-production blocked status');
requireText(finalRc, 'signed/notarized macOS', 'final RC signed/notarized blocker');

// 5. Audit doc must exist and reference T250.
const auditDoc = read('docs/release/mac-trust-boundary-audit.md');
requireText(auditDoc, 'M.18 T250', 'audit doc T250 anchor');
requireText(auditDoc, 'disable-library-validation', 'audit doc covers library-validation gap');

// 6. Fixture-mode bundle assertions (optional, env-gated).
const fixtureDir = process.env.MAC_BOUNDARY_FIXTURE_DIR;
if (fixtureDir) {
  const fixtureBundlePath = path.isAbsolute(fixtureDir) ? fixtureDir : path.join(root, fixtureDir);
  if (!existsSync(fixtureBundlePath)) {
    fail(`MAC_BOUNDARY_FIXTURE_DIR points at non-existent path: ${fixtureBundlePath}`);
  }
  const sidecar = path.join(fixtureBundlePath, 'signing-output.txt');
  assertBundleContract({
    bundlePath: fixtureBundlePath,
    signingOutputPath: sidecar,
  });
  console.log(`[mac-private-release-boundary] fixture-mode ok: ${fixtureBundlePath}`);
}

if (platform() !== 'darwin') {
  console.warn('[mac-private-release-boundary] non-darwin host: skipped codesign/stapler checks');
  console.log('[mac-private-release-boundary] ok: docs and config keep private mac release boundary explicit');
  process.exit(0);
}

if (!existsSync(appPath)) {
  fail('missing packaged app: apps/electron/release/mac-arm64/ROX.ONE.app; run electron:dist:dev:mac:arm64 first');
}

const codesignMetadata = run('codesign', ['-dv', '--verbose=4', appPath]);
if (codesignMetadata.status !== 0) {
  fail(`codesign metadata inspection failed:\n${codesignMetadata.output}`);
}
const codesignEntitlements = run('codesign', ['-d', '--entitlements', '-', appPath]);
if (codesignEntitlements.status !== 0) {
  fail(`codesign entitlement inspection failed:\n${codesignEntitlements.output}`);
}
const liveSigningOutput = `${codesignMetadata.output}\n${codesignEntitlements.output}`;
assertBundleContract({
  bundlePath: appPath,
  signingOutputText: liveSigningOutput,
  requireNativeBinaryEntries: false,
});
assertCodesignIdentifier(codesignMetadata.output);
requireText(codesignMetadata.output, 'Signature=adhoc', 'ad-hoc signature marker for private/local RC');
requireText(codesignMetadata.output, 'TeamIdentifier=not set', 'missing TeamIdentifier marker for private/local RC');

const stapler = run('xcrun', ['stapler', 'validate', appPath]);
if (stapler.status === 0) {
  fail('packaged app has a stapled notarization ticket; update the release trust-boundary contract before using this private-RC validator');
}
requireText(
  stapler.output,
  'does not have a ticket stapled to it',
  'missing notarization ticket marker for private/local RC',
);

// 7. Re-run entitlement gates against live codesign output with the same
//    failure wording older CI logs used before the bundle-contract helper
//    accepted live metadata.
for (const key of REQUIRED_CLIENT_ENTITLEMENTS) {
  requireText(liveSigningOutput, key, `required entitlement: ${key}`);
}
for (const key of FORBIDDEN_ENTITLEMENTS) {
  refuseText(liveSigningOutput, `<key>${key}</key>`, `forbidden entitlement (${key})`);
}

console.log('[mac-private-release-boundary] packaged app signature: adhoc, TeamIdentifier=not set');
console.log('[mac-private-release-boundary] packaged app notarization: no stapled ticket');
console.log('[mac-private-release-boundary] hardened runtime: ok; entitlements minimal');
console.log('[mac-private-release-boundary] ASAR/signing/notarization boundary is documented as private/local RC only');
