#!/usr/bin/env bun
import { existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import { spawn } from 'bun';

const root = process.cwd();

const outputDirs = [
  'apps/electron/dist/renderer',
  'apps/webui/dist',
  'apps/viewer/dist',
] as const;

const buildCommands = [
  ['bun', 'run', 'electron:build:renderer'],
  ['bun', 'run', 'webui:build'],
  ['bun', 'run', 'viewer:build'],
  ['bun', 'run', 'report:bundle-artifacts'],
] as const;

function removeOutputDir(relativePath: string): void {
  const absolutePath = path.join(root, relativePath);
  if (!existsSync(absolutePath)) {
    console.log(`[fresh-bundle-artifacts] clean skipped missing ${relativePath}`);
    return;
  }

  rmSync(absolutePath, { recursive: true, force: true });
  console.log(`[fresh-bundle-artifacts] removed ${relativePath}`);
}

async function runCommand(command: readonly string[]): Promise<void> {
  console.log(`\n[fresh-bundle-artifacts] running ${command.join(' ')}`);
  const proc = spawn({
    cmd: [...command],
    cwd: root,
    stdout: 'inherit',
    stderr: 'inherit',
    env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=4096' },
  });

  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    console.error(`[fresh-bundle-artifacts] command failed with code ${exitCode}: ${command.join(' ')}`);
    process.exit(exitCode);
  }
}

console.log('[fresh-bundle-artifacts] cleaning generated bundle outputs');
for (const outputDir of outputDirs) {
  removeOutputDir(outputDir);
}

for (const command of buildCommands) {
  await runCommand(command);
}

console.log('\n[fresh-bundle-artifacts] fresh bundle artifact report complete');
