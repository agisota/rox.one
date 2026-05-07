#!/usr/bin/env bun
import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const chunkWarningThresholdBytes = 500 * 1024;
const topAssetCount = 10;

const targets = [
  {
    name: 'Electron renderer',
    dir: path.join(root, 'apps/electron/dist/renderer'),
    assetBaseDir: path.join(root, 'apps/electron/dist/renderer'),
  },
  {
    name: 'WebUI',
    dir: path.join(root, 'apps/webui/dist'),
    assetBaseDir: path.join(root, 'apps/webui/dist'),
  },
  {
    name: 'Viewer',
    dir: path.join(root, 'apps/viewer/dist'),
    assetBaseDir: path.join(root, 'apps/viewer/dist'),
  },
] as const;

type AssetRecord = {
  absolutePath: string;
  relativePath: string;
  size: number;
  type: 'js' | 'css';
};

function fail(message: string): never {
  console.error(`[bundle-artifacts] ${message}`);
  process.exit(1);
}

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

    const size = statSync(absolutePath).size;
    assets.push({
      absolutePath,
      relativePath: path.relative(baseDir, absolutePath),
      size,
      type: extension === '.js' ? 'js' : 'css',
    });
  }

  return assets;
}

console.log(`[bundle-artifacts] chunk warning threshold: ${chunkWarningThresholdBytes} bytes (${formatBytes(chunkWarningThresholdBytes)})`);

let warned = false;

for (const target of targets) {
  if (!existsSync(target.dir)) {
    fail(`missing expected build output: ${path.relative(root, target.dir)}`);
  }

  const assets = collectAssets(target.assetBaseDir, target.assetBaseDir);
  const jsAssets = assets.filter((asset) => asset.type === 'js').sort((a, b) => b.size - a.size);
  const cssAssets = assets.filter((asset) => asset.type === 'css').sort((a, b) => b.size - a.size);
  const totalJs = jsAssets.reduce((sum, asset) => sum + asset.size, 0);
  const totalCss = cssAssets.reduce((sum, asset) => sum + asset.size, 0);
  const oversizedAssets = assets
    .filter((asset) => asset.size > chunkWarningThresholdBytes)
    .sort((a, b) => b.size - a.size);

  console.log(`\n[bundle-artifacts] ${target.name}`);
  console.log(`  output: ${path.relative(root, target.dir)}`);
  console.log(`  js assets: ${jsAssets.length}, total ${totalJs} bytes (${formatBytes(totalJs)})`);
  console.log(`  css assets: ${cssAssets.length}, total ${totalCss} bytes (${formatBytes(totalCss)})`);

  console.log(`  top ${Math.min(topAssetCount, jsAssets.length)} JS assets:`);
  if (jsAssets.length === 0) {
    console.log('    - none');
  } else {
    for (const asset of jsAssets.slice(0, topAssetCount)) {
      console.log(`    - ${asset.relativePath} :: ${asset.size} bytes (${formatBytes(asset.size)})`);
    }
  }

  console.log(`  top ${Math.min(topAssetCount, cssAssets.length)} CSS assets:`);
  if (cssAssets.length === 0) {
    console.log('    - none');
  } else {
    for (const asset of cssAssets.slice(0, topAssetCount)) {
      console.log(`    - ${asset.relativePath} :: ${asset.size} bytes (${formatBytes(asset.size)})`);
    }
  }

  if (oversizedAssets.length > 0) {
    warned = true;
    console.warn(`  WARN chunks/assets over ${formatBytes(chunkWarningThresholdBytes)}:`);
    for (const asset of oversizedAssets) {
      console.warn(`    - ${asset.relativePath} [${asset.type}] :: ${asset.size} bytes (${formatBytes(asset.size)})`);
    }
  } else {
    console.log(`  no JS/CSS assets exceed ${formatBytes(chunkWarningThresholdBytes)}`);
  }
}

if (warned) {
  console.warn('\n[bundle-artifacts] completed with size warnings only; warnings are non-fatal');
} else {
  console.log('\n[bundle-artifacts] completed with no size warnings');
}
