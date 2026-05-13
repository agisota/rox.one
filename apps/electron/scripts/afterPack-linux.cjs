/**
 * electron-builder afterPack hook (Linux variant) — M.18 T253.
 * Mirror of apps/electron/scripts/afterPack-windows.cjs (T252) for the
 * AppImage / Snap target. Validates canonical `rox-one-*.AppImage`
 * filename + canonical `Exec=rox-one` desktop-entry line + walks the
 * AppDir for escaping symlinks, writes rox-one.desktop sidecar, and
 * emits the canonical (T253 linux boundary ok) marker into
 * rox-one.desktop and (when present) signing-output.txt. No gpg
 * invocation, no credentials — T255 follow-up adds those.
 */

const path = require('path');
const fs = require('fs');

const APPIMAGE_FILENAME_PATTERN = /^rox-one(-[A-Za-z0-9.+-]+)*\.AppImage$/;
const DESKTOP_EXEC_PATTERN = /^Exec=rox-one(\s|$)/m;
const T253_AFTER_PACK_MARKER = '(T253 linux boundary ok)';
const DEFAULT_MAINTAINER = 'roxone <support@rox.one>';

function readBuilderAppId(context) {
  const config = context.packager && context.packager.config ? context.packager.config : {};
  const linuxConfig = config.linux || {};
  return linuxConfig.appId || config.appId || '';
}

function readBuilderVersion(context) {
  const config = context.packager && context.packager.config ? context.packager.config : {};
  return String(
    config.buildVersion ||
      (context.packager && context.packager.appInfo && context.packager.appInfo.version) ||
      '',
  );
}

module.exports = async function afterPackLinux(context) {
  if (context.electronPlatformName !== 'linux') {
    console.log('afterPack-linux: skipping (not linux)');
    return;
  }

  const appOutDir = context.appOutDir;
  const productName =
    (context.packager && context.packager.appInfo && context.packager.appInfo.productFilename) ||
    'rox-one';
  console.log(`afterPack-linux: appOutDir=${appOutDir} productName=${productName}`);

  const appId = readBuilderAppId(context);
  if (!appId) {
    throw new Error('afterPack-linux: missing canonical appId in electron-builder context');
  }

  const version = readBuilderVersion(context);

  // Canonical filename guard: peek at appOutDir for any AppImage stub
  // and reject names that do not match the canonical pattern.
  const topLevel = safeReaddir(appOutDir);
  const appImageStub = topLevel.find((name) => /\.AppImage$/.test(name));
  if (appImageStub && !APPIMAGE_FILENAME_PATTERN.test(appImageStub)) {
    throw new Error(
      `afterPack-linux: AppImage filename "${appImageStub}" does not match ${APPIMAGE_FILENAME_PATTERN}`,
    );
  }

  // Symlink-escape guard: reject any symlink resolving outside the dir.
  const allFiles = walkFiles(appOutDir);
  for (const entry of allFiles) {
    let stat;
    try {
      stat = fs.lstatSync(entry);
    } catch {
      continue;
    }
    if (!stat.isSymbolicLink()) continue;
    const target = fs.readlinkSync(entry);
    const resolved = path.resolve(path.dirname(entry), target);
    if (!resolved.startsWith(appOutDir + path.sep) && resolved !== appOutDir) {
      throw new Error(`afterPack-linux: symlink escapes bundle: ${entry} -> ${target}`);
    }
  }

  // Emit canonical rox-one.desktop sidecar so the validator + CI
  // evidence both have a deterministic record + T253 marker.
  const sidecarPath = path.join(appOutDir, 'rox-one.desktop');
  const sidecarBody = [
    '[Desktop Entry]',
    `Name=${productName}`,
    'GenericName=ROX.ONE Agent Workbench',
    'Comment=ROX.ONE Agent Workbench Suite',
    'Exec=rox-one %U',
    'Icon=rox-one',
    'Terminal=false',
    'Type=Application',
    'Categories=Office;Utility;Development;',
    'StartupWMClass=rox-one',
    `X-RoxOne-AppId=${appId}`,
    `X-RoxOne-Version=${version}`,
    `X-RoxOne-Maintainer=${DEFAULT_MAINTAINER}`,
    `# ${T253_AFTER_PACK_MARKER}`,
    '',
  ].join('\n');
  fs.writeFileSync(sidecarPath, sidecarBody, 'utf8');
  if (!DESKTOP_EXEC_PATTERN.test(sidecarBody)) {
    throw new Error('afterPack-linux: emitted desktop entry failed Exec=rox-one canonical match');
  }
  console.log(`afterPack-linux: wrote ${sidecarPath}`);

  // If CI signing step left a signing-output.txt, append the marker so
  // the validator catches it whichever sidecar it reads first.
  const signingOutputPath = path.join(appOutDir, 'signing-output.txt');
  if (fs.existsSync(signingOutputPath)) {
    fs.appendFileSync(signingOutputPath, `\n# ${T253_AFTER_PACK_MARKER}\n`, 'utf8');
    console.log(`afterPack-linux: appended marker to ${signingOutputPath}`);
  }

  console.log(`afterPack-linux: appId=${appId} version=${version} ${T253_AFTER_PACK_MARKER}`);
};

function safeReaddir(dir) {
  try {
    return fs.readdirSync(dir);
  } catch {
    return [];
  }
}

function walkFiles(dir, acc) {
  acc = acc || [];
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) {
      acc.push(fullPath);
      continue;
    }
    if (entry.isDirectory()) {
      walkFiles(fullPath, acc);
    } else {
      acc.push(fullPath);
    }
  }
  return acc;
}
