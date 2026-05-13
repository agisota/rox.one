#!/usr/bin/env bun
import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { spawn } from 'bun';

const root = process.cwd();
const chunkWarningThresholdBytes = 500 * 1024;

type AssetRecord = {
  relativePath: string;
  size: number;
  type: 'js' | 'css';
};

type BundlePolicy = {
  name: string;
  dir: string;
  maxJsAssets: number;
  maxCssAssets: number;
  maxTotalJsBytes: number;
  maxTotalCssBytes: number;
  maxOversizedAssets: number;
  maxLargestJsBytes: number;
};

const policies: readonly BundlePolicy[] = [
  {
    name: 'Electron renderer',
    dir: 'apps/electron/dist/renderer',
    // T132: raised from 320 → 360 to account for ~17 new lazy chunks
    // (WorkbenchRoutePage, ComposerArtifactPanel, 15 Settings pages)
    maxJsAssets: 360,
    maxCssAssets: 3,
    maxTotalJsBytes: 19_000_000,
    maxTotalCssBytes: 260_000,
    maxOversizedAssets: 7,
    maxLargestJsBytes: 5_800_000,
  },
  {
    name: 'WebUI',
    dir: 'apps/webui/dist',
    // T132: raised from 310 → 350 to account for ~17 new lazy chunks shared with Electron
    maxJsAssets: 350,
    maxCssAssets: 2,
    maxTotalJsBytes: 18_000_000,
    maxTotalCssBytes: 260_000,
    maxOversizedAssets: 5,
    maxLargestJsBytes: 5_800_000,
  },
  {
    name: 'Viewer',
    dir: 'apps/viewer/dist',
    maxJsAssets: 310,
    maxCssAssets: 2,
    maxTotalJsBytes: 15_300_000,
    maxTotalCssBytes: 140_000,
    maxOversizedAssets: 4,
    maxLargestJsBytes: 5_700_000,
  },
] as const;

function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(unitIndex === 0 ? 0 : 2)} ${units[unitIndex]}`;
}

function collectAssets(dir: string, baseDir: string): AssetRecord[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const assets: AssetRecord[] = [];

  for (const entry of entries) {
    const absolutePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      assets.push(...collectAssets(absolutePath, baseDir));
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const extension = path.extname(entry.name);
    if (extension !== '.js' && extension !== '.css') {
      continue;
    }

    assets.push({
      relativePath: path.relative(baseDir, absolutePath),
      size: statSync(absolutePath).size,
      type: extension === '.js' ? 'js' : 'css',
    });
  }

  return assets;
}

async function runFreshBundleReport(): Promise<void> {
  console.log('[bundle-policy] refreshing bundle outputs before policy validation');
  const proc = spawn({
    cmd: ['bun', 'run', 'report:bundle-artifacts:fresh'],
    cwd: root,
    stdout: 'inherit',
    stderr: 'inherit',
    env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=4096' },
  });

  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    console.error(`[bundle-policy] fresh bundle report failed with code ${exitCode}`);
    process.exit(exitCode);
  }
}

function addLimitError(errors: string[], label: string, actual: number, limit: number, suffix = ''): void {
  if (actual <= limit) {
    return;
  }

  errors.push(`${label}: ${actual}${suffix} exceeds ${limit}${suffix}`);
}

await runFreshBundleReport();

const errors: string[] = [];

for (const policy of policies) {
  const absoluteDir = path.join(root, policy.dir);
  if (!existsSync(absoluteDir)) {
    errors.push(`${policy.name}: missing build output ${policy.dir}`);
    continue;
  }

  const assets = collectAssets(absoluteDir, absoluteDir);
  const jsAssets = assets.filter((asset) => asset.type === 'js').sort((a, b) => b.size - a.size);
  const cssAssets = assets.filter((asset) => asset.type === 'css').sort((a, b) => b.size - a.size);
  if (jsAssets.length === 0 && cssAssets.length === 0) {
    errors.push(`${policy.name}: no JS/CSS assets found in ${policy.dir}`);
    continue;
  }

  const totalJsBytes = jsAssets.reduce((sum, asset) => sum + asset.size, 0);
  const totalCssBytes = cssAssets.reduce((sum, asset) => sum + asset.size, 0);
  const oversizedAssets = assets.filter((asset) => asset.size > chunkWarningThresholdBytes);
  const largestJs = jsAssets[0] ?? null;

  console.log(`\n[bundle-policy] ${policy.name}`);
  console.log(`  js assets: ${jsAssets.length}/${policy.maxJsAssets}, total ${totalJsBytes}/${policy.maxTotalJsBytes} bytes (${formatBytes(totalJsBytes)})`);
  console.log(`  css assets: ${cssAssets.length}/${policy.maxCssAssets}, total ${totalCssBytes}/${policy.maxTotalCssBytes} bytes (${formatBytes(totalCssBytes)})`);
  console.log(`  oversized JS/CSS assets: ${oversizedAssets.length}/${policy.maxOversizedAssets}`);
  if (largestJs) {
    console.log(`  largest JS: ${largestJs.relativePath} :: ${largestJs.size}/${policy.maxLargestJsBytes} bytes (${formatBytes(largestJs.size)})`);
  }

  addLimitError(errors, `${policy.name} JS asset count`, jsAssets.length, policy.maxJsAssets);
  addLimitError(errors, `${policy.name} CSS asset count`, cssAssets.length, policy.maxCssAssets);
  addLimitError(errors, `${policy.name} total JS bytes`, totalJsBytes, policy.maxTotalJsBytes);
  addLimitError(errors, `${policy.name} total CSS bytes`, totalCssBytes, policy.maxTotalCssBytes);
  addLimitError(errors, `${policy.name} oversized asset count`, oversizedAssets.length, policy.maxOversizedAssets);
  if (largestJs) {
    addLimitError(errors, `${policy.name} largest JS asset bytes`, largestJs.size, policy.maxLargestJsBytes);
  }
}

if (errors.length > 0) {
  console.error('\n[bundle-policy] bundle policy failed:');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log('\n[bundle-policy] ok: fresh bundle outputs stay within the current RC budget ceilings');
