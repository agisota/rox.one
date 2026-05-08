#!/usr/bin/env bun
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const workflowPath = path.join(root, '.github/workflows/mac-arm-build.yml');
const macArmConfigPath = path.join(root, 'apps/electron/electron-builder.mac-arm64.yml');
const macArmScriptPath = path.join(root, 'scripts/electron-dist-dev-mac-arm64.ts');

function fail(message: string): never {
  console.error(`[mac-arm-build-workflow] ${message}`);
  process.exit(1);
}

function requireText(source: string, expected: string, description: string) {
  if (!source.includes(expected)) {
    fail(`workflow missing ${description}: ${expected}`);
  }
}

const packageJson = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
const scripts = packageJson.scripts ?? {};

for (const scriptName of [
  'electron:build',
  'electron:smoke',
  'electron:smoke:packaged:mac',
  'electron:dist:dev:mac:arm64',
]) {
  if (typeof scripts[scriptName] !== 'string' || scripts[scriptName].length === 0) {
    fail(`package.json missing script: ${scriptName}`);
  }
}

if (!existsSync(workflowPath)) {
  fail('missing .github/workflows/mac-arm-build.yml');
}

if (!existsSync(macArmConfigPath)) {
  fail('missing apps/electron/electron-builder.mac-arm64.yml');
}

if (!existsSync(macArmScriptPath)) {
  fail('missing scripts/electron-dist-dev-mac-arm64.ts');
}

const workflow = readFileSync(workflowPath, 'utf8');
const macArmConfig = readFileSync(macArmConfigPath, 'utf8');
const macArmScript = readFileSync(macArmScriptPath, 'utf8');

requireText(workflow, 'runs-on: macos-15-xlarge', 'explicit macOS ARM64 runner');
requireText(workflow, 'bun install --frozen-lockfile', 'frozen dependency install');
requireText(workflow, 'bun run typecheck:all', 'typecheck gate');
requireText(workflow, 'bun run lint:i18n:parity', 'i18n parity gate');
requireText(workflow, 'bun run electron:build', 'electron build gate');
requireText(workflow, 'bun run electron:dist:dev:mac:arm64', 'arm64 dist gate');
requireText(workflow, 'bun run electron:smoke:packaged:mac', 'packaged launch smoke gate');
requireText(workflow, 'bun run electron:smoke', 'launch smoke gate');
requireText(workflow, 'ROX-ONE-arm64.dmg', 'DMG artifact path');
requireText(workflow, 'ROX-ONE-arm64.zip', 'ZIP artifact path');
requireText(workflow, 'mac-arm64/ROX.ONE.app', 'packaged app artifact path');
requireText(workflow, 'actions/upload-artifact@v4', 'artifact upload');
requireText(workflow, 'if-no-files-found: error', 'hard artifact upload failure');

requireText(scripts['electron:dist:dev:mac:arm64'], 'scripts/electron-dist-dev-mac-arm64.ts', 'arm64 dist wrapper');
requireText(macArmConfig, 'extends: electron-builder.yml', 'base electron-builder config extension');
requireText(macArmConfig, '- arm64', 'arm64 target arch');
if (macArmConfig.includes('- x64')) {
  fail('arm64 electron-builder config must not include x64 target arch');
}
requireText(macArmScript, "arch: ['arm64']", 'generated arm64-only builder target');
requireText(macArmScript, 'ELECTRON_BUILDER_CACHE', 'workspace-local electron-builder cache');
requireText(macArmScript, 'electron-builder', 'electron-builder invocation');

console.log('[mac-arm-build-workflow] ok: Mac ARM workflow contract passed');
