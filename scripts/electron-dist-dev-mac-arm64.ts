#!/usr/bin/env bun
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'bun';
import yaml from 'js-yaml';
import { downloadBun } from './build/common.ts';

const ROOT_DIR = join(import.meta.dir, '..');
const ELECTRON_DIR = join(ROOT_DIR, 'apps/electron');
const GENERATED_CONFIG_DIR = join(ROOT_DIR, '.build/electron');
const GENERATED_CONFIG_PATH = join(GENERATED_CONFIG_DIR, 'electron-builder.mac-arm64.generated.yml');
const ELECTRON_BUILDER_CACHE = join(ROOT_DIR, '.cache/electron-builder');
const ELECTRON_BUILDER_BIN = join(
  ROOT_DIR,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'electron-builder.cmd' : 'electron-builder',
);

function fail(message: string, code = 1): never {
  console.error(`[mac-arm64-dist] ${message}`);
  process.exit(code);
}

async function run(command: string[], cwd: string, env: Record<string, string | undefined> = {}) {
  const proc = spawn({
    cmd: command,
    cwd,
    stdout: 'inherit',
    stderr: 'inherit',
    env: {
      ...process.env,
      ...env,
    },
  });
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    fail(`${command.join(' ')} exited with code ${exitCode}`, exitCode);
  }
}

const baseConfig = yaml.load(readFileSync(join(ELECTRON_DIR, 'electron-builder.yml'), 'utf8')) as Record<string, unknown>;
const macConfig = {
  ...((baseConfig.mac as Record<string, unknown> | undefined) ?? {}),
  target: [
    {
      target: 'dmg',
      arch: ['arm64'],
    },
    {
      target: 'zip',
      arch: ['arm64'],
    },
  ],
};
const generatedConfig = {
  ...baseConfig,
  mac: macConfig,
};

mkdirSync(GENERATED_CONFIG_DIR, { recursive: true });
mkdirSync(ELECTRON_BUILDER_CACHE, { recursive: true });
writeFileSync(GENERATED_CONFIG_PATH, yaml.dump(generatedConfig, { lineWidth: 120 }), 'utf8');

// Fail fast on missing Rox Design runtime payload before spending build/CPU time.
// Set ROX_SKIP_ROX_DESIGN_PAYLOAD_VERIFY=1 only for dev smoke where packaged Rox Design is not exercised.
await run(['bun', 'run', 'rox-design:payload:verify'], ROOT_DIR);

await downloadBun({
  platform: 'darwin',
  arch: 'arm64',
  upload: false,
  uploadLatest: false,
  uploadScript: false,
  rootDir: ROOT_DIR,
  electronDir: ELECTRON_DIR,
});

await run(['bun', 'run', 'electron:build'], ROOT_DIR, {
  CSC_IDENTITY_AUTO_DISCOVERY: 'false',
  ROX_DEV_RUNTIME: '1',
  ELECTRON_BUILDER_CACHE,
});

// --publish=never is load-bearing on tag-triggered CI runs: electron-builder
// implicitly enables publishing whenever the working tree is on a git tag,
// which (without configured publisher credentials) silently skips writing
// latest-mac.yml — and downstream validate:packaged-artifacts then fails
// with "missing required artifact: latest-mac.yml". The linux + windows
// invocations in release-all-platforms.yml pass this flag directly for the
// same reason; mirror that here so the mac script behaves identically.
await run(
  [ELECTRON_BUILDER_BIN, '--config', GENERATED_CONFIG_PATH, '--mac', '--arm64', '--publish=never'],
  ELECTRON_DIR,
  {
    CSC_IDENTITY_AUTO_DISCOVERY: 'false',
    ROX_DEV_RUNTIME: '1',
    ELECTRON_BUILDER_CACHE,
  },
);
