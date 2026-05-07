#!/usr/bin/env bun
import { createHash } from 'node:crypto';
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
console.log(`[packaged-artifacts] latest-mac.yml size[dmg]=${(latestMac.files ?? []).find((f) => f.url === 'ROX-ONE-arm64.dmg')?.size ?? 'n/a'} bytes`);
console.log(`[packaged-artifacts] latest-mac.yml size[zip]=${(latestMac.files ?? []).find((f) => f.url === 'ROX-ONE-arm64.zip')?.size ?? 'n/a'} bytes`);
if ((latestMac.files ?? []).find((f) => f.url === 'ROX-ONE-arm64.dmg')?.size !== dmgStats.size) {
  fail('latest-mac.yml size for ROX-ONE-arm64.dmg does not match artifact on disk');
}
if ((latestMac.files ?? []).find((f) => f.url === 'ROX-ONE-arm64.zip')?.size !== zipStats.size) {
  fail('latest-mac.yml size for ROX-ONE-arm64.zip does not match artifact on disk');
}
console.log('[packaged-artifacts] latest-mac.yml artifact references verified');
