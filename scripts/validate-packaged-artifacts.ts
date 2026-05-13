#!/usr/bin/env bun
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

const root = process.cwd();
const releaseDir = path.join(root, 'apps/electron/release');

const requiredArtifacts = [
  'ROX-ONE-arm64.dmg',
  'ROX-ONE-arm64.zip',
  'ROX-ONE-arm64.dmg.blockmap',
  'ROX-ONE-arm64.zip.blockmap',
  'latest-mac.yml',
] as const;

function fail(message: string): never {
  console.error(`[packaged-artifacts] ${message}`);
  process.exit(1);
}

function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let idx = 0;
  while (value >= 1024 && idx < units.length - 1) {
    value /= 1024;
    idx += 1;
  }
  return `${value.toFixed(idx === 0 ? 0 : 2)} ${units[idx]}`;
}

function sha256(filePath: string): string {
  const hash = createHash('sha256');
  hash.update(readFileSync(filePath));
  return hash.digest('hex');
}

for (const relativePath of requiredArtifacts) {
  const fullPath = path.join(releaseDir, relativePath);
  if (!existsSync(fullPath)) {
    fail(`missing required artifact: apps/electron/release/${relativePath}`);
  }
}

const dmgPath = path.join(releaseDir, 'ROX-ONE-arm64.dmg');
const zipPath = path.join(releaseDir, 'ROX-ONE-arm64.zip');
const latestMacPath = path.join(releaseDir, 'latest-mac.yml');
const packagedBunPath = path.join(
  releaseDir,
  'mac-arm64/ROX.ONE.app/Contents/Resources/app/vendor/bun/bun',
);

const latestMac = yaml.load(readFileSync(latestMacPath, 'utf8')) as {
  files?: Array<{ url?: string; size?: number }>;
  path?: string;
};

const urls = new Set((latestMac.files ?? []).map((entry) => entry.url).filter((v): v is string => typeof v === 'string'));
if (!urls.has('ROX-ONE-arm64.zip')) {
  fail('latest-mac.yml missing ROX-ONE-arm64.zip in files[]');
}
if (!urls.has('ROX-ONE-arm64.dmg')) {
  fail('latest-mac.yml missing ROX-ONE-arm64.dmg in files[]');
}
if (latestMac.path !== 'ROX-ONE-arm64.zip') {
  fail(`latest-mac.yml path must reference ROX-ONE-arm64.zip, got: ${String(latestMac.path)}`);
}

if (!existsSync(packagedBunPath)) {
  fail('missing packaged runtime: apps/electron/release/mac-arm64/ROX.ONE.app/Contents/Resources/app/vendor/bun/bun');
}

const fileProbe = spawnSync('file', [packagedBunPath], { encoding: 'utf8' });
if (fileProbe.status !== 0) {
  fail(`failed to inspect packaged runtime with file(1): ${fileProbe.stderr.trim() || fileProbe.error?.message || 'unknown error'}`);
}
const fileDescription = fileProbe.stdout.trim();
if (!fileDescription.includes('Mach-O 64-bit executable arm64')) {
  fail(`packaged runtime must be macOS arm64 Mach-O, got: ${fileDescription}`);
}

const runtimeProbe = spawnSync(packagedBunPath, ['-e', 'console.log(process.platform, process.arch)'], {
  encoding: 'utf8',
});
if (runtimeProbe.status !== 0) {
  fail(`packaged runtime failed to execute: ${runtimeProbe.stderr.trim() || runtimeProbe.error?.message || 'unknown error'}`);
}
const runtimeTarget = runtimeProbe.stdout.trim();
if (runtimeTarget !== 'darwin arm64') {
  fail(`packaged runtime target must be "darwin arm64", got: ${runtimeTarget}`);
}

const dmgStats = statSync(dmgPath);
const zipStats = statSync(zipPath);

console.log('[packaged-artifacts] required packaged artifacts present');
for (const relativePath of requiredArtifacts) {
  const fullPath = path.join(releaseDir, relativePath);
  const stats = statSync(fullPath);
  console.log(`- apps/electron/release/${relativePath} :: ${stats.size} bytes (${formatBytes(stats.size)})`);
}
console.log(`[packaged-artifacts] SHA256 ROX-ONE-arm64.dmg ${sha256(dmgPath)}`);
console.log(`[packaged-artifacts] SHA256 ROX-ONE-arm64.zip ${sha256(zipPath)}`);
console.log(`[packaged-artifacts] latest-mac.yml path=${latestMac.path}`);
console.log(`[packaged-artifacts] packaged runtime ${fileDescription}`);
console.log(`[packaged-artifacts] packaged runtime probe=${runtimeTarget}`);
console.log(`[packaged-artifacts] latest-mac.yml size[dmg]=${(latestMac.files ?? []).find((f) => f.url === 'ROX-ONE-arm64.dmg')?.size ?? 'n/a'} bytes`);
console.log(`[packaged-artifacts] latest-mac.yml size[zip]=${(latestMac.files ?? []).find((f) => f.url === 'ROX-ONE-arm64.zip')?.size ?? 'n/a'} bytes`);
if ((latestMac.files ?? []).find((f) => f.url === 'ROX-ONE-arm64.dmg')?.size !== dmgStats.size) {
  fail('latest-mac.yml size for ROX-ONE-arm64.dmg does not match artifact on disk');
}
if ((latestMac.files ?? []).find((f) => f.url === 'ROX-ONE-arm64.zip')?.size !== zipStats.size) {
  fail('latest-mac.yml size for ROX-ONE-arm64.zip does not match artifact on disk');
}
console.log('[packaged-artifacts] latest-mac.yml artifact references verified');
