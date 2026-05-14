/**
 * electron-builder afterSign hook for private/local macOS RC artifacts.
 *
 * CircleCI private builds use ad-hoc signing (`-`) with no Apple credentials.
 * electron-builder can produce an ad-hoc signature without the hardened
 * runtime bit in that mode, so dev-runtime builds re-sign nested code entries
 * first and the final app bundle last with `--options runtime` and the minimal
 * app entitlements.
 *
 * Production signing/notarization must not be overwritten here. The hook only
 * runs when the dev-runtime build path opts in via ROX_DEV_RUNTIME=1.
 */

const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');

const SIGNABLE_DIRECTORY_EXTENSIONS = new Set(['.app', '.framework', '.xpc', '.appex']);
const SIGNABLE_FILE_EXTENSIONS = new Set(['.dylib', '.node', '.so']);
const SIGNABLE_FILE_NAMES = new Set(['bun', 'rg', 'claude', 'codex', 'copilot']);

function isInsideMacOSDirectory(filePath) {
  return filePath.split(path.sep).includes('MacOS');
}

function isSignableDirectory(filePath) {
  return SIGNABLE_DIRECTORY_EXTENSIONS.has(path.extname(filePath));
}

function isSignableFile(filePath) {
  return (
    SIGNABLE_FILE_EXTENSIONS.has(path.extname(filePath)) ||
    SIGNABLE_FILE_NAMES.has(path.basename(filePath)) ||
    isInsideMacOSDirectory(filePath)
  );
}

function collectSignablePaths(rootPath) {
  const signablePaths = [];

  function visit(currentPath) {
    let entries = [];
    try {
      entries = fs.readdirSync(currentPath, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      if (entry.isSymbolicLink()) {
        continue;
      }
      if (entry.isDirectory()) {
        visit(fullPath);
        if (isSignableDirectory(fullPath)) {
          signablePaths.push(fullPath);
        }
        continue;
      }
      if (entry.isFile() && isSignableFile(fullPath)) {
        signablePaths.push(fullPath);
      }
    }
  }

  visit(rootPath);
  return [...new Set(signablePaths)].sort((left, right) => {
    const rightDepth = right.split(path.sep).length;
    const leftDepth = left.split(path.sep).length;
    if (rightDepth !== leftDepth) return rightDepth - leftDepth;
    return left.localeCompare(right);
  });
}

function codesign(targetPath, entitlementsPath) {
  execFileSync('codesign', [
    '--force',
    '--sign',
    '-',
    '--options',
    'runtime',
    '--entitlements',
    entitlementsPath,
    targetPath,
  ], {
    stdio: 'inherit',
  });
}

async function afterSign(context) {
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

  const nestedSignablePaths = collectSignablePaths(path.join(bundlePath, 'Contents'));
  for (const targetPath of nestedSignablePaths) {
    codesign(targetPath, entitlementsPath);
  }
  codesign(bundlePath, entitlementsPath);

  console.log(
    `afterSign: ad-hoc signed ${bundlePath} with hardened runtime ` +
      `(${nestedSignablePaths.length} nested entries)`,
  );
}

module.exports = afterSign;
module.exports.collectSignablePaths = collectSignablePaths;
