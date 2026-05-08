import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'bun:test';

const rootDir = join(import.meta.dir, '..', '..');
const electronResourcesDir = join(rootDir, 'apps/electron/resources');

function resourcePath(relativePath: string): string {
  return join(electronResourcesDir, relativePath);
}

function read(relativePath: string): string {
  return readFileSync(join(rootDir, relativePath), 'utf8');
}

describe('macOS Liquid Glass icon contract', () => {
  const assetsCar = resourcePath('Assets.car');
  const iconSources = [
    resourcePath('icon.svg'),
    resourcePath('icon.png'),
    resourcePath('icon.icon/icon.json'),
    resourcePath('icon.icon/Assets/icon.svg'),
    resourcePath('icon.icon/Assets/icon.png'),
  ];

  it('keeps the precompiled Assets.car fresh relative to icon catalog sources', () => {
    expect(existsSync(assetsCar)).toBe(true);

    const assetsCarMtime = statSync(assetsCar).mtimeMs;
    const staleSources = iconSources
      .filter((source) => existsSync(source) && statSync(source).mtimeMs > assetsCarMtime)
      .map((source) => relative(rootDir, source));

    expect(staleSources).toEqual([]);
  });

  it('treats the icon catalog manifest as a stale-asset source', () => {
    const afterPack = read('apps/electron/scripts/afterPack.cjs');

    expect(afterPack).toContain("resources', 'icon.icon', 'icon.json'");
    expect(afterPack).toContain('liquidGlassIconManifest');
  });

  it('keeps the packaged icon name aligned with actool output', () => {
    const builderConfig = read('apps/electron/electron-builder.yml');
    const afterPack = read('apps/electron/scripts/afterPack.cjs');
    const readme = read('apps/electron/README.md');

    expect(builderConfig).toContain('CFBundleIconName: icon');
    expect(builderConfig).not.toContain('CFBundleIconName: AppIcon');
    expect(afterPack).toContain('--app-icon icon');
    expect(afterPack).not.toContain('--app-icon AppIcon');
    expect(readme).toContain('--app-icon icon');
    expect(readme).not.toContain('--app-icon AppIcon');
  });
});
