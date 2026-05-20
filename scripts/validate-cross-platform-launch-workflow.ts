#!/usr/bin/env bun
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const workflowPath = '.github/workflows/cross-platform-launch.yml';

function fail(message: string): never {
  console.error(`[cross-platform-launch-workflow] ${message}`);
  process.exit(1);
}

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

function requireText(source: string, expected: string, description: string): void {
  if (!source.includes(expected)) fail(`missing ${description}: ${expected}`);
}

function requireInstallStepToken(source: string): void {
  const normalized = source.replace(/\r\n?/g, '\n');
  const installSections = normalized.split(/\n\s+- name: Install dependencies\n/g).slice(1);
  if (installSections.length < 3) {
    fail(`expected at least 3 Install dependencies steps, found ${installSections.length}`);
  }

  for (const [index, section] of installSections.entries()) {
    const stepBody = section.split(/\n\s+- name: /)[0] ?? section;
    if (!stepBody.includes('GITHUB_TOKEN: ${{ github.token }}')) {
      fail(`Install dependencies step ${index + 1} does not pass GITHUB_TOKEN for GitHub Release postinstall downloads`);
    }
  }
}

if (!existsSync(path.join(root, workflowPath))) {
  fail(`missing ${workflowPath}`);
}

const workflow = read(workflowPath);
const packagedSmoke = read('scripts/electron-smoke-packaged.ts');
const packageJson = JSON.parse(read('package.json')) as { scripts?: Record<string, string> };
const scripts = packageJson.scripts ?? {};

requireInstallStepToken(workflow);

for (const [scriptName, expected] of [
  ['electron:smoke:packaged', 'scripts/electron-smoke-packaged.ts'],
  ['validate:cross-platform-launch-workflow', 'scripts/validate-cross-platform-launch-workflow.ts'],
] as const) {
  const actual = scripts[scriptName];
  if (typeof actual !== 'string' || !actual.includes(expected)) {
    fail(`package.json missing script ${scriptName} -> ${expected}`);
  }
}

if (!String(scripts['validate:ci'] ?? '').includes('validate:cross-platform-launch-workflow')) {
  fail('validate:ci does not include validate:cross-platform-launch-workflow');
}

const macPayloadPrepareIndex = workflow.indexOf('Prepare Rox Design runtime payload');
const macPackageIndex = workflow.indexOf('Package ROX.ONE for macOS ARM64');
if (macPayloadPrepareIndex === -1) fail('macOS launch job does not prepare the Rox Design runtime payload');
if (macPackageIndex === -1) fail('macOS launch job is missing the package step');
if (macPayloadPrepareIndex > macPackageIndex) {
  fail('macOS launch job prepares the Rox Design runtime payload after packaging');
}

for (const required of [
  'name: Cross Platform Launch Smoke',
  'workflow_dispatch:',
  'runs-on: macos-15-xlarge',
  '- windows-latest',
  '- windows-2022',
  '- ubuntu-22.04',
  '- ubuntu-24.04',
  'debian:12',
  'fedora:40',
  'nixos/nix',
  'bun run electron:smoke:packaged',
  'bun run validate:packaged-artifacts',
  'bun run validate:linux-installer-launcher',
  'xvfb',
  'ROX_ARTIFACT_PLATFORM: mac',
  'ROX_ARTIFACT_PLATFORM: linux',
  'ROX_ARTIFACT_PLATFORM: windows',
  'Prepare Rox Design runtime payload',
  'OPEN_DESIGN_VERSION="0.7.0"',
  'OPEN_DESIGN_ASSET="open-design-${OPEN_DESIGN_VERSION}-mac-arm64.zip"',
  'shasum -a 256 -c',
  'ROX_DESIGN_SOURCE_RESOURCES="${OPEN_DESIGN_RESOURCES}"',
  'bun run rox-design:prepare -- --force',
  'bun run rox-design:payload:verify',
]) {
  requireText(workflow, required, 'cross-platform launch workflow contract');
}

for (const required of [
  'linux-unpacked/rox-one',
  'win-unpacked/ROX.ONE.exe',
  'mac-arm64/ROX.ONE.app',
  '--no-sandbox',
  'xvfb-run',
  'ROX_SMOKE_USER_DATA_DIR',
  'ROX_CONFIG_DIR',
]) {
  requireText(packagedSmoke, required, 'cross-platform packaged smoke contract');
}

console.log('[cross-platform-launch-workflow] ok: desktop launch workflow + packaged smoke contracts are wired');
