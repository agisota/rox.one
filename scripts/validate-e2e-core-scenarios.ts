#!/usr/bin/env bun
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const suitePath = path.join(root, 'scripts/e2e-core-scenarios.ts');
const workflowPath = path.join(root, '.github/workflows/e2e-core.yml');

function fail(message: string): never {
  console.error(`[e2e-core] ${message}`);
  process.exit(1);
}

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

const packageJson = JSON.parse(read('package.json'));
const scripts = packageJson.scripts ?? {};

for (const scriptName of ['e2e:core', 'validate:e2e-core-scenarios']) {
  if (typeof scripts[scriptName] !== 'string' || scripts[scriptName].length === 0) {
    fail(`package.json missing script: ${scriptName}`);
  }
}

if (!existsSync(suitePath)) {
  fail('missing scripts/e2e-core-scenarios.ts');
}

if (!existsSync(workflowPath)) {
  fail('missing .github/workflows/e2e-core.yml');
}

const suite = read('scripts/e2e-core-scenarios.ts');
const workflow = read('.github/workflows/e2e-core.yml');

for (const requiredText of [
  'composer-artifact-flow.test.ts',
  'artifact-screens.test.tsx',
  'account-auth-panel.test.tsx',
  'account-teams.test.ts',
  'account-billing.test.ts',
  'object-storage.test.ts',
  'packages/server/src/__tests__/smoke.test.ts',
  'electron:smoke',
]) {
  if (!suite.includes(requiredText)) {
    fail(`suite missing scenario command: ${requiredText}`);
  }
}

for (const requiredText of [
  'bun install --frozen-lockfile',
  'bun run validate:e2e-core-scenarios',
  'bun run e2e:core',
  'actions/upload-artifact@v4',
  '.e2e-logs',
]) {
  if (!workflow.includes(requiredText)) {
    fail(`workflow missing: ${requiredText}`);
  }
}

if (!suite.includes('CRAFT_E2E_FAKE_PROVIDERS')) {
  fail('suite must force fake providers for e2e scenarios');
}

if (suite.includes('OPENAI_API_KEY') || suite.includes('ANTHROPIC_API_KEY') || suite.includes('AWS_SECRET_ACCESS_KEY')) {
  fail('suite must not reference real provider secret names');
}

console.log('[e2e-core] ok: core scenario suite contract passed');
