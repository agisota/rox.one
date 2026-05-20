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

if (!existsSync(path.join(root, workflowPath))) {
  fail(`missing ${workflowPath}`);
}

const workflow = read(workflowPath);
const packagedSmoke = read('scripts/electron-smoke-packaged.ts');
const packageJson = JSON.parse(read('package.json')) as { scripts?: Record<string, string> };
const scripts = packageJson.scripts ?? {};

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
  'ROX_SKIP_ROX_DESIGN_PAYLOAD_VERIFY: "1"',
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
