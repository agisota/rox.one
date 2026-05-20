/**
 * electron-builder afterPack hook
 *
 * Copies the pre-compiled macOS 26+ Liquid Glass icon (Assets.car) into the
 * app bundle. The Assets.car file is compiled locally using actool with the
 * macOS 26 SDK (not available in CI), then committed to the repo.
 *
 * To regenerate Assets.car after icon changes:
 *   cd apps/electron
 *   tmpdir=$(mktemp -d /tmp/rox-icon-actool-XXXXXX)
 *   xcrun actool "resources/icon.icon" --compile "$tmpdir" \
 *     --app-icon icon --minimum-deployment-target 26.0 \
 *     --platform macosx --output-partial-info-plist "$tmpdir/partial.plist"
 *   cp "$tmpdir/Assets.car" resources/Assets.car
 *
 * For older macOS versions, the app falls back to icon.icns which is
 * included separately by electron-builder.
 */

const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
const ICON_SOURCE_MTIME_SKEW_MS = 1000;

module.exports = async function afterPack(context) {
  // Only process macOS builds
  if (context.electronPlatformName !== 'darwin') {
    console.log('Skipping Liquid Glass icon (not macOS)');
    return;
  }

  const appPath = context.appOutDir;
  const bundleName = 'ROX.ONE.app';
  const bundlePath = path.join(appPath, bundleName);
  const resourcesDir = path.join(bundlePath, 'Contents', 'Resources');
  const duplicateRoxDesignPayload = path.join(resourcesDir, 'app', 'dist', 'resources', 'rox-design');
  if (fs.existsSync(duplicateRoxDesignPayload)) {
    fs.rmSync(duplicateRoxDesignPayload, { recursive: true, force: true });
    console.log(`afterPack: removed duplicate Rox Design payload at ${duplicateRoxDesignPayload}`);
  }
  // B-H1 (PZD audit): assert that Rox Design native deps were not silently dropped
  // by the broad !node_modules/**/* exclusion in electron-builder.yml.
  // Skipped when ROX_SKIP_ROX_DESIGN_PAYLOAD_VERIFY=1 (CI smoke without payload)
  // or when the rox-design payload directory is absent (not-yet-bundled builds).
  const roxDesignPayloadDir = path.join(resourcesDir, 'app', 'resources', 'rox-design', 'app', 'node_modules');
  if (process.env.ROX_SKIP_ROX_DESIGN_PAYLOAD_VERIFY !== '1' && fs.existsSync(roxDesignPayloadDir)) {
    const requiredNativeDeps = ['better-sqlite3', 'blake3-wasm'];
    for (const dep of requiredNativeDeps) {
      const depPath = path.join(roxDesignPayloadDir, dep);
      if (!fs.existsSync(depPath)) {
        throw new Error(
          `[B-H1] Rox Design native dep missing from packaged app: ${depPath}\n` +
          `Expected: resources/rox-design/**/node_modules/${dep}\n` +
          `The broad !node_modules/**/* exclusion in electron-builder.yml may have ` +
          `dropped this directory. Verify that the re-include glob ` +
          `"resources/rox-design/**/node_modules/**/*" appears AFTER the exclusion rule.`
        );
      }
      console.log(`afterPack [B-H1]: verified ${dep} present in packaged rox-design payload`);
    }
  } else {
    console.log('afterPack [B-H1]: skipping rox-design payload verification (payload absent or ROX_SKIP_ROX_DESIGN_PAYLOAD_VERIFY=1)');
  }

  const precompiledAssets = path.join(context.packager.projectDir, 'resources', 'Assets.car');
  const rootIconSvg = path.join(context.packager.projectDir, 'resources', 'icon.svg');
  const rootIconPng = path.join(context.packager.projectDir, 'resources', 'icon.png');
  const liquidGlassIconManifest = path.join(context.packager.projectDir, 'resources', 'icon.icon', 'icon.json');
  const liquidGlassIconSvg = path.join(context.packager.projectDir, 'resources', 'icon.icon', 'Assets', 'icon.svg');
  const liquidGlassIconPng = path.join(context.packager.projectDir, 'resources', 'icon.icon', 'Assets', 'icon.png');

  console.log(`afterPack: projectDir=${context.packager.projectDir}`);
  console.log(`afterPack: looking for Assets.car at ${precompiledAssets}`);

  const helperNames = [
    'ROX.ONE Helper',
    'ROX.ONE Helper (GPU)',
    'ROX.ONE Helper (Plugin)',
    'ROX.ONE Helper (Renderer)',
  ];

  const updatePlistString = (plistPath, key, value) => {
    if (!fs.existsSync(plistPath)) {
      return;
    }

    try {
      execFileSync('plutil', ['-replace', key, '-string', value, plistPath]);
      console.log(`Updated ${key} in ${path.basename(path.dirname(plistPath))} -> ${value}`);
    } catch (err) {
      console.log(`Warning: Could not update ${key} in ${plistPath}: ${err.message}`);
    }
  };

  const removePlistKey = (plistPath, key) => {
    if (!fs.existsSync(plistPath)) {
      return;
    }

    try {
      execFileSync('plutil', ['-remove', key, plistPath]);
      console.log(`Removed stale ${key} from ${path.basename(path.dirname(plistPath))}`);
    } catch (err) {
      if (!String(err.message).includes('Entry, "' + key + '", Does Not Exist')) {
        console.log(`Warning: Could not remove ${key} in ${plistPath}: ${err.message}`);
      }
    }
  };

  const useFallbackIcns = () => {
    removePlistKey(path.join(bundlePath, 'Contents', 'Info.plist'), 'CFBundleIconName');
  };

  // electron-builder brands helper app display names, but CFBundleName can
  // still remain "Electron Helper" unless we normalize it before signing.
  const rootInfoPlist = path.join(bundlePath, 'Contents', 'Info.plist');
  updatePlistString(rootInfoPlist, 'CFBundleName', 'ROX.ONE');
  updatePlistString(rootInfoPlist, 'CFBundleDisplayName', 'ROX.ONE');
  for (const helperName of helperNames) {
    updatePlistString(
      path.join(bundlePath, 'Contents', 'Frameworks', `${helperName}.app`, 'Contents', 'Info.plist'),
      'CFBundleName',
      helperName,
    );
  }

  // T250 trust-boundary post-pack guards: assert canonical bundle-id +
  // build-number shape are present after electron-builder writes Info.plist.
  // We log + fail loudly here rather than letting an off-scope identifier or
  // a missing CFBundleVersion slip through to codesign.
  try {
    const plistJson = execFileSync('plutil', ['-convert', 'json', '-o', '-', rootInfoPlist], {
      encoding: 'utf8',
    });
    const info = JSON.parse(plistJson);
    const bundleId = info.CFBundleIdentifier;
    const bundleVersion = info.CFBundleVersion;
    if (typeof bundleId !== 'string' || !/^com\.rox\.one(\.[A-Za-z0-9-]+)*$/.test(bundleId)) {
      throw new Error(`CFBundleIdentifier "${bundleId}" does not match com.rox.one[.*] scope`);
    }
    const versionString = String(bundleVersion ?? '');
    if (!versionString || !versionString.split('.').every((seg) => /^\d+$/.test(seg))) {
      throw new Error(`CFBundleVersion "${versionString}" is not a monotonic Apple build number`);
    }
    console.log(`afterPack: bundle-id=${bundleId} build=${versionString} (T250 boundary ok)`);
  } catch (err) {
    // plutil only ships on macOS; on cross-builds skip silently so Linux/Windows
    // CI can still package without macOS host tools. The validator script
    // catches the same gaps on darwin and in fixture-mode tests.
    if (process.platform !== 'darwin') {
      console.log(`afterPack: skipping bundle-id guard (non-darwin): ${err.message}`);
    } else {
      throw err;
    }
  }

  // Check if pre-compiled Assets.car exists
  if (!fs.existsSync(precompiledAssets)) {
    console.log('Warning: Pre-compiled Assets.car not found in resources/');
    console.log('The app will use the fallback icon.icns on all macOS versions');
    useFallbackIcns();
    return;
  }

  // If the source icon changed after Assets.car was generated, prefer the
  // updated fallback icon.icns rather than shipping a stale Liquid Glass asset.
  const assetCatalogSources = [
    rootIconSvg,
    rootIconPng,
    liquidGlassIconManifest,
    liquidGlassIconSvg,
    liquidGlassIconPng,
  ].filter(fs.existsSync);
  if (assetCatalogSources.length > 0) {
    const assetsCarMtime = fs.statSync(precompiledAssets).mtimeMs;
    const freshestSourceMtime = Math.max(...assetCatalogSources.map(source => fs.statSync(source).mtimeMs));
    if (freshestSourceMtime - assetsCarMtime > ICON_SOURCE_MTIME_SKEW_MS) {
      console.log('Warning: Assets.car is older than the current icon sources');
      console.log('Skipping stale Liquid Glass asset; the app will use fallback icon.icns');
      useFallbackIcns();
      return;
    }
  }

  // Copy pre-compiled Assets.car to the app bundle
  const destAssetsCar = path.join(resourcesDir, 'Assets.car');
  try {
    fs.copyFileSync(precompiledAssets, destAssetsCar);
    console.log(`Liquid Glass icon copied: ${destAssetsCar}`);
  } catch (err) {
    // Don't fail the build if Assets.car can't be copied - app will use fallback icon.icns
    console.log(`Warning: Could not copy Assets.car: ${err.message}`);
    console.log('The app will use the fallback icon.icns on all macOS versions');
    useFallbackIcns();
  }
};
