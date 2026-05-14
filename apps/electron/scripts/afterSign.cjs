/**
 * electron-builder afterSign hook for private/local macOS RC artifacts.
 *
 * CircleCI private builds use ad-hoc signing (`-`) with no Apple credentials.
 * electron-builder can produce an ad-hoc signature without the hardened
 * runtime bit in that mode, so dev-runtime builds re-sign the final app bundle
 * explicitly with `--options runtime` and the minimal app entitlements.
 *
 * Production signing/notarization must not be overwritten here. The hook only
 * runs when the dev-runtime build path opts in via ROX_DEV_RUNTIME=1.
 */

const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');

module.exports = async function afterSign(context) {
  if (context.electronPlatformName !== 'darwin') {
    console.log('afterSign: skipping hardened-runtime ad-hoc signing (not macOS)');
    return;
  }

  if (process.env.ROX_DEV_RUNTIME !== '1') {
    console.log('afterSign: skipping hardened-runtime ad-hoc signing (not ROX_DEV_RUNTIME=1)');
    return;
  }

  const bundlePath = path.join(context.appOutDir, 'ROX.ONE.app');
  const entitlementsRelativePath = 'build/entitlements.mac.plist';
  const entitlementsPath = path.join(context.packager.projectDir, ...entitlementsRelativePath.split('/'));

  if (!fs.existsSync(bundlePath)) {
    throw new Error(`afterSign: missing app bundle: ${bundlePath}`);
  }
  if (!fs.existsSync(entitlementsPath)) {
    throw new Error(`afterSign: missing entitlements file: ${entitlementsPath}`);
  }

  execFileSync('codesign', [
    '--force',
    '--deep',
    '--sign',
    '-',
    '--options',
    'runtime',
    '--entitlements',
    entitlementsPath,
    bundlePath,
  ], {
    stdio: 'inherit',
  });

  console.log(`afterSign: ad-hoc signed ${bundlePath} with hardened runtime`);
};
