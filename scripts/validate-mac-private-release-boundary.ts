#!/usr/bin/env bun
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { platform } from 'node:os';
import path from 'node:path';

const root = process.cwd();
const appPath = path.join(root, 'apps/electron/release/mac-arm64/ROX.ONE.app');

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

function run(command: string, args: string[]): { status: number | null; output: string } {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
  });

  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim();
  if (result.error) {
    fail(`${command} failed to start: ${result.error.message}`);
  }

  return { status: result.status, output };
}

const packageJson = JSON.parse(read('package.json'));
const scripts = packageJson.scripts ?? {};
const boundaryScript = scripts['validate:mac-private-release-boundary'];
if (
  typeof boundaryScript !== 'string' ||
  !boundaryScript.includes('scripts/validate-mac-private-release-boundary.ts')
) {
  fail('package.json missing validate:mac-private-release-boundary script entry');
}

const builderConfig = read('apps/electron/electron-builder.yml');
requireText(builderConfig, 'asar: false', 'documented local-RC ASAR-disabled setting');
requireText(
  builderConfig,
  'Code signing & notarization (disabled by default for local builds)',
  'local signing/notarization boundary comment',
);
requireText(builderConfig, 'CSC_LINK', 'production signing credential hint');
requireText(builderConfig, 'APPLE_TEAM_ID', 'production notarization team hint');

const readinessMatrix = read('docs/release/production-readiness-matrix-2026-05-06.md');
requireText(readinessMatrix, 'Public production: no.', 'public-production blocked decision');
requireText(readinessMatrix, 'signed/notarized release', 'signed/notarized release blocker');

const finalRc = read('docs/release/final-rc-2026-05-06.md');
requireText(finalRc, 'Public production launch status: blocked', 'final RC public-production blocked status');
requireText(finalRc, 'signed/notarized macOS', 'final RC signed/notarized blocker');

if (platform() !== 'darwin') {
  console.warn('[mac-private-release-boundary] non-darwin host: skipped codesign/stapler checks');
  console.log('[mac-private-release-boundary] ok: docs and config keep private mac release boundary explicit');
  process.exit(0);
}

if (!existsSync(appPath)) {
  fail('missing packaged app: apps/electron/release/mac-arm64/ROX.ONE.app; run electron:dist:dev:mac:arm64 first');
}

const codesign = run('codesign', ['-dv', '--verbose=4', appPath]);
if (codesign.status !== 0) {
  fail(`codesign inspection failed:\n${codesign.output}`);
}
requireText(codesign.output, 'Identifier=com.rox.one', 'ROX.ONE code signing identifier');
requireText(codesign.output, 'Signature=adhoc', 'ad-hoc signature marker for private/local RC');
requireText(codesign.output, 'TeamIdentifier=not set', 'missing TeamIdentifier marker for private/local RC');

const stapler = run('xcrun', ['stapler', 'validate', appPath]);
if (stapler.status === 0) {
  fail('packaged app has a stapled notarization ticket; update the release trust-boundary contract before using this private-RC validator');
}
requireText(
  stapler.output,
  'does not have a ticket stapled to it',
  'missing notarization ticket marker for private/local RC',
);

console.log('[mac-private-release-boundary] packaged app signature: adhoc, TeamIdentifier=not set');
console.log('[mac-private-release-boundary] packaged app notarization: no stapled ticket');
console.log('[mac-private-release-boundary] ASAR/signing/notarization boundary is documented as private/local RC only');
