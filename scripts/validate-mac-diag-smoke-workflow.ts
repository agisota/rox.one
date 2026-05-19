#!/usr/bin/env bun
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const workflowPath = '.github/workflows/mac-diag-smoke.yml';

function fail(message: string): never {
  console.error(`[mac-diag-smoke-workflow] ${message}`);
  process.exit(1);
}

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

function requireText(source: string, expected: string, description: string): void {
  if (!source.includes(expected)) fail(`missing ${description}: ${expected}`);
}

if (!existsSync(path.join(root, workflowPath))) fail(`missing ${workflowPath}`);

const workflow = read(workflowPath);
const packageJson = JSON.parse(read('package.json')) as { scripts?: Record<string, string> };
const scripts = packageJson.scripts ?? {};

for (const [scriptName, expected] of [
  ['validate:mac-diag-smoke-workflow', 'scripts/validate-mac-diag-smoke-workflow.ts'],
] as const) {
  const actual = scripts[scriptName];
  if (typeof actual !== 'string' || !actual.includes(expected)) {
    fail(`package.json missing script ${scriptName} -> ${expected}`);
  }
}

if (!String(scripts['validate:ci'] ?? '').includes('validate:mac-diag-smoke-workflow')) {
  fail('validate:ci does not include validate:mac-diag-smoke-workflow');
}

for (const required of [
  'name: Mac White-Window Diag Smoke',
  'workflow_dispatch:',
  'push:',
  'branches:',
  'fix/multiplatform-mac-*',
  'runs-on: ${{ matrix.os }}',
  'os: [macos-14, macos-15]',
  'Ventura (macos-13) is intentionally not in the push matrix',
  'GITHUB_TOKEN: ${{ github.token }}',
  'FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: "true"',
  'bun run electron:build',
  'bunx electron-builder --mac --arm64 --x64 --dir --publish=never',
  'node /tmp/diag-launch.mjs',
  'actions/upload-artifact',
  '/tmp/diag-${{ matrix.os }}.png',
  '/tmp/electron-builder-${{ matrix.os }}.log',
]) {
  requireText(workflow, required, 'mac diag smoke workflow contract');
}

if (workflow.includes('os: [macos-13, macos-14, macos-15]')) {
  fail('push matrix still includes macos-13, which can queue indefinitely and block PRs');
}

console.log('[mac-diag-smoke-workflow] ok: Sonoma/Sequoia diag smoke workflow is wired; Ventura proof remains VM/self-hosted');
