#!/usr/bin/env bun
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function fail(message: string): never {
  console.error(`[private-release-pipeline] ${message}`);
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

const packageJson = JSON.parse(read('package.json'));
const scripts = packageJson.scripts ?? {};

for (const scriptName of [
  'validate:docs',
  'lint',
  'typecheck:all',
  'test',
  'electron:build',
  'validate:mac-arm-build-workflow',
  'validate:private-release-pipeline',
  'validate:release',
]) {
  if (typeof scripts[scriptName] !== 'string' || scripts[scriptName].length === 0) {
    fail(`package.json missing script: ${scriptName}`);
  }
}

const validateRelease = scripts['validate:release'];
for (const requiredCommand of [
  'validate:docs',
  'lint',
  'typecheck:all',
  'bun test',
  'electron:build',
  'validate:mac-arm-build-workflow',
  'validate:private-release-pipeline',
]) {
  if (!validateRelease.includes(requiredCommand)) {
    fail(`validate:release does not include ${requiredCommand}`);
  }
}

const validateCi = scripts['validate:ci'];
if (!validateCi.includes('validate:private-release-pipeline')) {
  fail('validate:ci does not include validate:private-release-pipeline');
}

const workflowPath = '.github/workflows/private-release.yml';
if (!existsSync(path.join(root, workflowPath))) {
  fail(`missing ${workflowPath}`);
}

const workflow = read(workflowPath);
for (const [expected, description] of [
  ['name: Private Release Candidate', 'private release workflow name'],
  ['workflow_dispatch:', 'manual dispatch trigger'],
  ['pull_request:', 'pull request trigger'],
  ['push:', 'push trigger'],
  ['branches:', 'branch filter'],
  ['permissions:', 'explicit permissions block'],
  ['contents: read', 'read-only contents permission'],
  ['actions/upload-artifact@v4', 'private artifact upload action'],
  ['if-no-files-found: error', 'hard artifact upload failure'],
  ['retention-days: 14', 'private artifact retention'],
  ['bun install --frozen-lockfile', 'frozen install'],
  ['bun run validate:private-release-pipeline', 'pipeline contract validation'],
  ['bun run validate:docs', 'docs validation gate'],
  ['bun run lint', 'lint gate'],
  ['bun run typecheck:all', 'typecheck gate'],
  ['bun test', 'full deterministic test gate'],
  ['bun run electron:build', 'Electron build gate'],
  ['bun run validate:mac-arm-build-workflow', 'Mac ARM workflow contract gate'],
  ['.ci-logs/private-release', 'release log directory'],
  ['apps/electron/dist', 'Electron dist artifact path'],
  ['docs/release', 'release docs artifact path'],
] as const) {
  requireText(workflow, expected, description);
}

const macArmWorkflow = read('.github/workflows/mac-arm-build.yml');
for (const requiredText of [
  'runs-on: macos-15-xlarge',
  'bun run electron:dist:dev:mac:arm64',
  'actions/upload-artifact@v4',
  'if-no-files-found: error',
]) {
  requireText(macArmWorkflow, requiredText, 'Mac ARM workflow release gate');
}

console.log('[private-release-pipeline] ok: private release workflow, scripts, and artifact gates passed');
