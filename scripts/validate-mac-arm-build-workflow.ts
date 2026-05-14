#!/usr/bin/env bun
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const workflowPath = path.join(root, '.github/workflows/mac-arm-build.yml');
const builderConfigPath = path.join(root, 'apps/electron/electron-builder.yml');
const beforeBuildHookPath = path.join(root, 'apps/electron/scripts/beforeBuild.cjs');
const afterSignHookPath = path.join(root, 'apps/electron/scripts/afterSign.cjs');
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

function refuseText(source: string, forbidden: string, description: string) {
  if (source.includes(forbidden)) {
    fail(`workflow contains forbidden ${description}: ${forbidden}`);
  }
}

const packageJson = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
const scripts = packageJson.scripts ?? {};

for (const scriptName of [
  'electron:build',
  'electron:smoke',
  'electron:smoke:packaged:mac',
  'electron:dist:dev:mac:arm64',
  'validate:mac-private-release-boundary',
  'validate:packaged-artifacts',
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

if (!existsSync(builderConfigPath)) {
  fail('missing apps/electron/electron-builder.yml');
}

if (!existsSync(beforeBuildHookPath)) {
  fail('missing apps/electron/scripts/beforeBuild.cjs');
}

if (!existsSync(afterSignHookPath)) {
  fail('missing apps/electron/scripts/afterSign.cjs');
}

if (!existsSync(macArmScriptPath)) {
  fail('missing scripts/electron-dist-dev-mac-arm64.ts');
}

const workflow = readFileSync(workflowPath, 'utf8');
const builderConfig = readFileSync(builderConfigPath, 'utf8');
const beforeBuildHook = readFileSync(beforeBuildHookPath, 'utf8');
const afterSignHook = readFileSync(afterSignHookPath, 'utf8');
const macArmConfig = readFileSync(macArmConfigPath, 'utf8');
const macArmScript = readFileSync(macArmScriptPath, 'utf8');

requireText(workflow, 'runs-on: macos-15-xlarge', 'explicit macOS ARM64 runner');
requireText(workflow, 'bun install --frozen-lockfile', 'frozen dependency install');
requireText(workflow, 'bun run typecheck:all', 'typecheck gate');
requireText(workflow, 'bun run lint:i18n:parity', 'i18n parity gate');
requireText(workflow, 'bun run electron:build', 'electron build gate');
requireText(workflow, 'bun run electron:dist:dev:mac:arm64', 'arm64 dist gate');
requireText(workflow, 'bun run electron:smoke:packaged:mac', 'packaged launch smoke gate');
requireText(workflow, 'bun run validate:packaged-artifacts', 'packaged artifact validation gate');
requireText(workflow, 'bun run validate:mac-private-release-boundary', 'private mac release trust-boundary gate');
requireText(workflow, 'bun run electron:smoke', 'launch smoke gate');
requireText(workflow, 'ROX-ONE-arm64.dmg', 'DMG artifact path');
requireText(workflow, 'ROX-ONE-arm64.zip', 'ZIP artifact path');
requireText(workflow, 'mac-arm64/ROX.ONE.app', 'packaged app artifact path');
requireText(workflow, 'actions/upload-artifact@v4', 'artifact upload');
requireText(workflow, 'if-no-files-found: error', 'hard artifact upload failure');

requireText(scripts['electron:dist:dev:mac:arm64'], 'scripts/electron-dist-dev-mac-arm64.ts', 'arm64 dist wrapper');
requireText(
  scripts['validate:mac-private-release-boundary'],
  'scripts/validate-mac-private-release-boundary.ts',
  'private mac release trust-boundary validator',
);
requireText(scripts['validate:packaged-artifacts'], 'scripts/validate-packaged-artifacts.ts', 'packaged artifact validator');
requireText(macArmConfig, 'extends: electron-builder.yml', 'base electron-builder config extension');
requireText(macArmConfig, '- arm64', 'arm64 target arch');
if (macArmConfig.includes('- x64')) {
  fail('arm64 electron-builder config must not include x64 target arch');
}
requireText(builderConfig, 'beforeBuild: scripts/beforeBuild.cjs', 'external node_modules beforeBuild hook');
requireText(builderConfig, 'afterSign: scripts/afterSign.cjs', 'private mac hardened-runtime afterSign hook');
requireText(builderConfig, 'identity: "-"', 'ad-hoc mac signing identity');
requireText(beforeBuildHook, 'return false', 'beforeBuild external node_modules signal');
requireText(afterSignHook, 'ROX_DEV_RUNTIME', 'private mac afterSign dev-runtime guard');
requireText(afterSignHook, 'codesign', 'private mac afterSign codesign invocation');
requireText(afterSignHook, "'--options'", 'private mac afterSign codesign options flag');
requireText(afterSignHook, "'runtime'", 'private mac afterSign hardened runtime option');
requireText(afterSignHook, "'--entitlements'", 'private mac afterSign entitlements flag');
requireText(afterSignHook, 'build/entitlements.mac.plist', 'private mac afterSign entitlements path');
requireText(afterSignHook, 'collectSignablePaths', 'private mac afterSign explicit nested signing plan');
refuseText(afterSignHook, "'--deep'", 'private mac afterSign blanket nested signing flag');
requireText(macArmScript, "arch: ['arm64']", 'generated arm64-only builder target');
requireText(macArmScript, 'downloadBun', 'Darwin arm64 Bun runtime download');
requireText(macArmScript, "platform: 'darwin'", 'Darwin runtime platform');
requireText(macArmScript, "arch: 'arm64'", 'arm64 runtime architecture');
requireText(macArmScript, 'ELECTRON_BUILDER_CACHE', 'workspace-local electron-builder cache');
requireText(macArmScript, 'electron-builder', 'electron-builder invocation');

console.log('[mac-arm-build-workflow] ok: Mac ARM workflow contract passed');
